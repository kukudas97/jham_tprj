package com.jham.asset.service;

import com.jham.asset.mapper.AssetMapper;
import com.jham.asset.mapper.AssetCategoryMapper;
import com.jham.asset.mapper.AssetFieldValueMapper;
import com.jham.asset.mapper.AssetUploadMapper;
import com.jham.asset.mapper.CategoryFieldDefMapper;
import com.jham.asset.mapper.DepartmentMapper;
import com.jham.asset.mapper.TeamMapper;
import com.jham.asset.util.BizException;
import com.jham.asset.util.SessionUtil;

import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.InputStream;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;

/**
 * 자산 엑셀 업로드 서비스
 *
 * xlsx 파일을 통한 자산 일괄 등록 처리
 * - 시트명 = 대분류명 (없으면 자동 생성)
 * - 소분류(자산명) 없으면 자동 생성
 * - 부서/팀 없으면 자동 생성
 * - 식별번호 이후 컬럼 → 대분류 커스텀 필드 자동 생성 후 값 저장
 * - 동일 식별번호 자산 존재 시 → 업데이트 (INSERT/UPDATE 분기)
 *
 * 엑셀 컬럼 구조:
 *   자산명(필수) | 부서명(필수) | 팀명(선택) | 관리자(선택) | 품명(필수) | 식별번호(필수) | [커스텀필드...]
 *
 * 처리 순서:
 *   Pass 1 - 전체 시트 필수값 사전 검증 (오류 수집 후 일괄 반환)
 *   Pass 2 - DB 삽입 (캐시 활용)
 *
 * @author JHAM 개발팀
 * @since 2026-05-26
 */
@Service
public class AssetUploadService {

    private static final Logger logger = LoggerFactory.getLogger(AssetUploadService.class);

    /** 고정 컬럼명 목록 — 식별번호 이후 추가 컬럼만 커스텀 필드로 처리 */
    private static final List<String> FIXED_COLS =
            Arrays.asList("자산명", "부서명", "팀명", "관리자", "품명", "식별번호");

    /** 업로드 처리 결과 상태 코드 */
    public static final String STATUS_SUCCESS = "success";
    public static final String STATUS_FAILED  = "error";

    @Autowired
    private AssetMapper assetMapper;

    @Autowired
    private AssetCategoryMapper categoryMapper;

    @Autowired
    private CategoryFieldDefMapper fieldDefMapper;

    @Autowired
    private AssetFieldValueMapper fieldValueMapper;

    @Autowired
    private DepartmentMapper departmentMapper;

    @Autowired
    private TeamMapper teamMapper;

    @Autowired
    private AssetUploadMapper uploadMapper;

    /**
     * 엑셀 업로드 처리
     *
     * 업로드된 xlsx 파일을 파싱하여 자산 일괄 등록
     * - Pass 1 에서 오류 발견 시 전체 중단 후 오류 목록 반환 (부분 저장 없음)
     * - 처리 완료(성공/실패) 후 asset_uploads 테이블에 이력 저장
     * - 등록 건수가 0인 경우도 오류 처리
     *
     * Guards:
     *   - 파일명 필수
     *   - xlsx 파일만 허용
     *   - 시트가 1개 이상 존재해야 함
     *   - 각 시트에 자산명/부서명/품명/식별번호 컬럼 존재 필수
     *   - 값이 있는 행은 4개 필수값 모두 입력 필수
     *
     * @param paramMap 업로드 정보 (filename, file_stream)
     * @return 업로드 결과 (status, inserted_count, error_message)
     */
    @Transactional
    public HashMap<String, Object> uploadAssets(HashMap<String, Object> paramMap) {
        HashMap<String, Object> resultMap = new HashMap<>();

        String filename = (String) paramMap.getOrDefault("filename", "upload.xlsx");
        String uploadStatus = STATUS_SUCCESS;
        String errorMessage = null;
        int insertedCount = 0;

        try {
            int companyId = SessionUtil.getCurrentCompanyId();

            InputStream fileStream = (InputStream) paramMap.get("file_stream");
            if (fileStream == null) {
                throw new BizException("ERR_UPLOAD_001", "파일이 없습니다.");
            }

            if (!filename.endsWith(".xlsx") && !filename.endsWith(".xls")) {
                throw new BizException("ERR_UPLOAD_002", "xlsx 또는 xls 파일만 업로드 가능합니다.");
            }

            Workbook workbook = new XSSFWorkbook(fileStream);
            int sheetCount = workbook.getNumberOfSheets();
            if (sheetCount == 0) {
                throw new BizException("ERR_UPLOAD_003", "시트가 없습니다.");
            }

            // ── Pass 1: 전체 시트 필수값 사전 검증 ────────────────────────────
            List<String> validationErrors = new ArrayList<>();

            for (int si = 0; si < sheetCount; si++) {
                Sheet sheet = workbook.getSheetAt(si);
                String sheetName = workbook.getSheetName(si);

                Row headerRow = sheet.getRow(0);
                if (headerRow == null) continue;

                // 컬럼 인덱스 탐색
                int colProduct = findColIndex(headerRow, "품명");
                int colAsset   = findColIndex(headerRow, "자산명");
                int colDept    = findColIndex(headerRow, "부서명");
                int colIdNum   = findColIndex(headerRow, "식별번호");

                // 필수 컬럼 존재 여부 검사
                for (int[] pair : new int[][]{{colProduct, 0}, {colAsset, 1}, {colDept, 2}, {colIdNum, 3}}) {
                    String[] labels = {"품명", "자산명", "부서명", "식별번호"};
                    if (pair[0] < 0) {
                        validationErrors.add(
                                String.format("'%s' 시트: '%s' 컬럼이 없습니다.", sheetName, labels[pair[1]]));
                    }
                }
                if (colProduct < 0 || colAsset < 0 || colDept < 0 || colIdNum < 0) continue;

                for (int rowNum = 1; rowNum <= sheet.getLastRowNum(); rowNum++) {
                    Row row = sheet.getRow(rowNum);
                    if (row == null) continue;

                    String vProduct = getCellString(row, colProduct);
                    String vAsset   = getCellString(row, colAsset);
                    String vDept    = getCellString(row, colDept);
                    String vIdNum   = getCellString(row, colIdNum);

                    // 4개 모두 비어있으면 빈 행 → 스킵
                    if (vProduct == null && vAsset == null && vDept == null && vIdNum == null) continue;

                    // 하나라도 값이 있으면 나머지도 필수
                    if (vProduct == null) validationErrors.add(
                            String.format("'%s' 시트 %d행: '품명'이 없습니다.", sheetName, rowNum + 1));
                    if (vAsset == null) validationErrors.add(
                            String.format("'%s' 시트 %d행: '자산명'이 없습니다.", sheetName, rowNum + 1));
                    if (vDept == null) validationErrors.add(
                            String.format("'%s' 시트 %d행: '부서명'이 없습니다.", sheetName, rowNum + 1));
                    if (vIdNum == null) validationErrors.add(
                            String.format("'%s' 시트 %d행: '식별번호'가 없습니다.", sheetName, rowNum + 1));
                }
            }

            // Pass 1 오류가 있으면 전체 중단 (부분 저장 없음)
            if (!validationErrors.isEmpty()) {
                throw new BizException("ERR_UPLOAD_004",
                        String.format("필수값 누락 오류 (%d건):\n%s",
                                validationErrors.size(), String.join("\n", validationErrors)));
            }

            // ── Pass 2: 캐시 로드 후 실제 DB 삽입 ──────────────────────────
            List<HashMap<String, Object>> allCategories =
                    categoryMapper.selectAllByCompany(companyId);
            List<HashMap<String, Object>> allFieldDefs =
                    fieldDefMapper.selectByCompany(companyId);
            List<HashMap<String, Object>> deptCache =
                    departmentMapper.selectAllActiveByCompany(companyId);
            List<HashMap<String, Object>> teamCache =
                    teamMapper.selectAllActiveByCompany(companyId);

            for (int si = 0; si < sheetCount; si++) {
                Sheet sheet      = workbook.getSheetAt(si);
                String sheetName = workbook.getSheetName(si);
                Row headerRow    = sheet.getRow(0);
                if (headerRow == null) continue;

                // 대분류 찾기/자동 생성
                HashMap<String, Object> parentCat =
                        findOrCreateParentCategory(allCategories, sheetName, companyId);

                int colProduct = findColIndex(headerRow, "품명");
                int colAsset   = findColIndex(headerRow, "자산명");
                int colDept    = findColIndex(headerRow, "부서명");
                int colIdNum   = findColIndex(headerRow, "식별번호");
                int colTeam    = findColIndex(headerRow, "팀명");
                int colManager = findColIndex(headerRow, "관리자");

                // 식별번호 이후 추가 컬럼 → 커스텀 필드 자동 생성
                List<int[]> extraCols = new ArrayList<>();          // [컬럼인덱스, field_def_id]
                for (int c = colIdNum + 1; c < headerRow.getLastCellNum(); c++) {
                    String colLabel = getCellString(headerRow, c);
                    if (colLabel == null || FIXED_COLS.contains(colLabel)) continue;

                    HashMap<String, Object> fieldDef =
                            findOrCreateFieldDef(allFieldDefs, colLabel, parentCat, companyId);
                    extraCols.add(new int[]{c, (int) fieldDef.get("id")});
                }

                // 소분류 캐시 (시트 내 자동생성 항목 즉시 반영)
                List<HashMap<String, Object>> childrenCache = new ArrayList<>();
                for (HashMap<String, Object> cat : allCategories) {
                    if (parentCat.get("id").equals(cat.get("parent_id"))) {
                        childrenCache.add(cat);
                    }
                }

                for (int rowNum = 1; rowNum <= sheet.getLastRowNum(); rowNum++) {
                    Row row = sheet.getRow(rowNum);
                    if (row == null) continue;

                    String productName = getCellString(row, colProduct);
                    if (productName == null) continue; // 빈 행 스킵

                    String assetName = getCellString(row, colAsset);
                    String deptName  = getCellString(row, colDept);
                    String idNumber  = getCellString(row, colIdNum);
                    String teamName  = colTeam  >= 0 ? getCellString(row, colTeam)  : null;
                    String manager   = colManager >= 0 ? getCellString(row, colManager) : null;

                    // 소분류 찾기/자동 생성
                    HashMap<String, Object> childCat =
                            findOrCreateChildCategory(allCategories, childrenCache, assetName, parentCat, companyId);

                    // 부서 찾기/자동 생성
                    HashMap<String, Object> dept =
                            findOrCreateDepartment(deptCache, deptName, companyId);

                    // 팀 찾기/자동 생성
                    Integer teamId = null;
                    if (teamName != null) {
                        HashMap<String, Object> team =
                                findOrCreateTeam(teamCache, teamName, (int) dept.get("id"), companyId);
                        teamId = (int) team.get("id");
                    }

                    // 동일 식별번호 자산 조회 → 있으면 UPDATE, 없으면 INSERT
                    HashMap<String, Object> existingAsset = findAssetBySerial(idNumber, companyId);

                    int assetId;
                    if (existingAsset != null) {
                        // 기존 자산 UPDATE
                        HashMap<String, Object> upd = new HashMap<>();
                        upd.put("id", existingAsset.get("id"));
                        upd.put("name", productName);
                        upd.put("location", deptName);
                        upd.put("category_id", childCat.get("id"));
                        upd.put("department_id", dept.get("id"));
                        upd.put("team_id", teamId);
                        upd.put("manager_name", manager);
                        upd.put("updated_at", LocalDateTime.now());
                        assetMapper.updateAsset(upd);
                        assetId = (int) existingAsset.get("id");
                        logger.debug("[엑셀업로드] 자산 업데이트 - serial: {}", idNumber);
                    } else {
                        // 신규 자산 INSERT
                        HashMap<String, Object> ins = new HashMap<>();
                        ins.put("name", productName);
                        ins.put("serial_number", idNumber);
                        ins.put("location", deptName);
                        ins.put("note", null);
                        ins.put("company_id", companyId);
                        ins.put("category_id", childCat.get("id"));
                        ins.put("department_id", dept.get("id"));
                        ins.put("team_id", teamId);
                        ins.put("manager_name", manager);
                        ins.put("created_at", LocalDateTime.now());
                        ins.put("updated_at", LocalDateTime.now());
                        assetMapper.insertAsset(ins);
                        assetId = (int) ins.get("id");
                        logger.debug("[엑셀업로드] 자산 신규등록 - serial: {}", idNumber);
                    }

                    // 추가 컬럼 → 커스텀 필드 값 upsert
                    for (int[] extra : extraCols) {
                        String val = getCellString(row, extra[0]);
                        if (val == null) continue;
                        upsertFieldValue(assetId, extra[1], val);
                    }

                    insertedCount++;
                }
            }
            workbook.close();

            if (insertedCount == 0) {
                throw new BizException("ERR_UPLOAD_005",
                        "등록된 자산이 없습니다. 필수 컬럼(자산명, 부서명, 품명, 식별번호)과 데이터를 확인하세요.");
            }

            logger.info("[엑셀업로드] 완료 - filename: {}, inserted: {}", filename, insertedCount);

        } catch (BizException e) {
            logger.warn("[엑셀업로드] 업무오류 - code: {}, msg: {}", e.getErrorCode(), e.getMessage());
            uploadStatus = STATUS_FAILED;
            errorMessage = e.getMessage();
        } catch (Exception e) {
            logger.error("[엑셀업로드] 시스템오류 발생", e);
            uploadStatus = STATUS_FAILED;
            errorMessage = "시스템 오류가 발생하였습니다.";
        }

        // 업로드 이력 저장 (성공/실패 무관하게 항상 기록)
        try {
            HashMap<String, Object> uploadRecord = new HashMap<>();
            uploadRecord.put("company_id", SessionUtil.getCurrentCompanyId());
            uploadRecord.put("filename", filename);
            uploadRecord.put("status", uploadStatus);
            uploadRecord.put("error_message", errorMessage);
            uploadRecord.put("created_at", LocalDateTime.now());
            uploadRecord.put("updated_at", LocalDateTime.now());
            uploadMapper.insertUploadRecord(uploadRecord);
        } catch (Exception e) {
            logger.warn("[엑셀업로드] 이력 저장 실패", e);
        }

        resultMap.put("result_code", STATUS_SUCCESS.equals(uploadStatus) ? "0000" : "ERR_UPLOAD");
        resultMap.put("result_msg", errorMessage != null ? errorMessage : "업로드가 완료되었습니다.");
        resultMap.put("status", uploadStatus);
        resultMap.put("inserted_count", insertedCount);
        resultMap.put("filename", filename);
        return resultMap;
    }

    /* ========== Private Helper Methods ========== */

    /** 대분류 찾기 or 자동 생성 (캐시 갱신 포함) */
    private HashMap<String, Object> findOrCreateParentCategory(
            List<HashMap<String, Object>> cache, String name, int companyId) {

        for (HashMap<String, Object> c : cache) {
            if (c.get("parent_id") == null && name.equals(c.get("name"))) return c;
        }

        HashMap<String, Object> ins = new HashMap<>();
        ins.put("name", name);
        ins.put("company_id", companyId);
        ins.put("parent_id", null);
        ins.put("require_serial_number", false);
        ins.put("require_location", false);
        ins.put("require_note", false);
        ins.put("created_at", LocalDateTime.now());
        ins.put("updated_at", LocalDateTime.now());
        categoryMapper.insertCategory(ins);
        cache.add(ins);
        logger.info("[엑셀업로드] 대분류 자동 생성: {}", name);
        return ins;
    }

    /** 소분류 찾기 or 자동 생성 (캐시 갱신 포함) */
    private HashMap<String, Object> findOrCreateChildCategory(
            List<HashMap<String, Object>> allCache,
            List<HashMap<String, Object>> childrenCache,
            String name, HashMap<String, Object> parent, int companyId) {

        for (HashMap<String, Object> c : childrenCache) {
            if (name.equals(c.get("name"))) return c;
        }

        HashMap<String, Object> ins = new HashMap<>();
        ins.put("name", name);
        ins.put("company_id", companyId);
        ins.put("parent_id", parent.get("id"));
        ins.put("require_serial_number", false);
        ins.put("require_location", false);
        ins.put("require_note", false);
        ins.put("created_at", LocalDateTime.now());
        ins.put("updated_at", LocalDateTime.now());
        categoryMapper.insertCategory(ins);
        allCache.add(ins);
        childrenCache.add(ins);
        logger.info("[엑셀업로드] 소분류 자동 생성: {} (부모: {})", name, parent.get("name"));
        return ins;
    }

    /** 커스텀 필드 정의 찾기 or 자동 생성 (캐시 갱신 포함) */
    private HashMap<String, Object> findOrCreateFieldDef(
            List<HashMap<String, Object>> cache, String label,
            HashMap<String, Object> parentCat, int companyId) {

        int parentCatId = (int) parentCat.get("id");
        for (HashMap<String, Object> d : cache) {
            if (parentCatId == (int) d.get("category_id") &&
                    (label.equals(d.get("field_label")) || label.equals(d.get("field_name")))) {
                return d;
            }
        }

        // 현재 대분류의 최대 sort_order 계산
        int maxOrder = cache.stream()
                .filter(d -> parentCatId == (int) d.get("category_id"))
                .mapToInt(d -> (int) d.get("sort_order"))
                .max().orElse(-1);

        HashMap<String, Object> ins = new HashMap<>();
        ins.put("category_id", parentCatId);
        ins.put("company_id", companyId);
        ins.put("field_name", label);
        ins.put("field_label", label);
        ins.put("is_required", false);
        ins.put("sort_order", maxOrder + 1);
        ins.put("created_at", LocalDateTime.now());
        ins.put("updated_at", LocalDateTime.now());
        fieldDefMapper.insertFieldDef(ins);
        cache.add(ins);
        logger.info("[엑셀업로드] 커스텀 필드 자동 생성: {}", label);
        return ins;
    }

    /** 부서 찾기 or 자동 생성 */
    private HashMap<String, Object> findOrCreateDepartment(
            List<HashMap<String, Object>> cache, String name, int companyId) {

        for (HashMap<String, Object> d : cache) {
            if (name.equals(d.get("name"))) return d;
        }

        HashMap<String, Object> ins = new HashMap<>();
        ins.put("name", name);
        ins.put("company_id", companyId);
        ins.put("created_at", LocalDateTime.now());
        ins.put("updated_at", LocalDateTime.now());
        departmentMapper.insertDepartment(ins);
        cache.add(ins);
        logger.info("[엑셀업로드] 부서 자동 생성: {}", name);
        return ins;
    }

    /** 팀 찾기 or 자동 생성 */
    private HashMap<String, Object> findOrCreateTeam(
            List<HashMap<String, Object>> cache, String name, int deptId, int companyId) {

        for (HashMap<String, Object> t : cache) {
            if (name.equals(t.get("name")) && deptId == (int) t.get("department_id")) return t;
        }

        HashMap<String, Object> ins = new HashMap<>();
        ins.put("name", name);
        ins.put("department_id", deptId);
        ins.put("company_id", companyId);
        ins.put("created_at", LocalDateTime.now());
        ins.put("updated_at", LocalDateTime.now());
        teamMapper.insertTeam(ins);
        cache.add(ins);
        logger.info("[엑셀업로드] 팀 자동 생성: {} (부서ID: {})", name, deptId);
        return ins;
    }

    /** serial_number로 기존 자산 조회 (soft-delete 제외) */
    private HashMap<String, Object> findAssetBySerial(String serialNumber, int companyId) {
        HashMap<String, Object> param = new HashMap<>();
        param.put("serial_number", serialNumber);
        param.put("company_id", companyId);
        return assetMapper.selectBySerialAndCompany(param);
    }

    /** 커스텀 필드 값 upsert (존재하면 UPDATE, 없으면 INSERT) */
    private void upsertFieldValue(int assetId, int fieldDefId, String value) {
        HashMap<String, Object> param = new HashMap<>();
        param.put("asset_id", assetId);
        param.put("field_def_id", fieldDefId);

        HashMap<String, Object> existing = fieldValueMapper.selectByAssetAndFieldDef(param);
        if (existing != null) {
            param.put("value", value);
            param.put("updated_at", LocalDateTime.now());
            fieldValueMapper.updateFieldValue(param);
        } else {
            param.put("value", value);
            param.put("created_at", LocalDateTime.now());
            param.put("updated_at", LocalDateTime.now());
            fieldValueMapper.insertFieldValue(param);
        }
    }

    /** 헤더 행에서 컬럼명으로 인덱스 탐색 — 없으면 -1 반환 */
    private int findColIndex(Row headerRow, String colName) {
        Iterator<Cell> it = headerRow.iterator();
        int idx = 0;
        while (it.hasNext()) {
            Cell cell = it.next();
            if (colName.equals(getCellStringRaw(cell))) return idx;
            idx++;
        }
        return -1;
    }

    /** 행에서 특정 인덱스 셀 문자열 추출 (숫자/정수는 문자열로 변환) */
    private String getCellString(Row row, int colIdx) {
        if (row == null || colIdx < 0) return null;
        Cell cell = row.getCell(colIdx);
        return getCellStringRaw(cell);
    }

    private String getCellStringRaw(Cell cell) {
        if (cell == null) return null;
        String val;
        switch (cell.getCellType()) {
            case STRING:  val = cell.getStringCellValue().trim(); break;
            case NUMERIC:
                double d = cell.getNumericCellValue();
                val = (d == Math.floor(d)) ? String.valueOf((long) d) : String.valueOf(d);
                break;
            case BOOLEAN: val = String.valueOf(cell.getBooleanCellValue()); break;
            default:      return null;
        }
        return val.isEmpty() ? null : val;
    }
}
