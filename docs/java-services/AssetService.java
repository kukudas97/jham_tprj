package com.jham.asset.service;

import com.jham.asset.mapper.AssetMapper;
import com.jham.asset.mapper.AssetCategoryMapper;
import com.jham.asset.mapper.AssetFieldValueMapper;
import com.jham.asset.mapper.CategoryFieldDefMapper;
import com.jham.asset.mapper.DepartmentMapper;
import com.jham.asset.mapper.TeamMapper;
import com.jham.asset.mapper.QrCodeMapper;
import com.jham.asset.util.BizException;
import com.jham.asset.util.QrCodeUtil;
import com.jham.asset.util.SessionUtil;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;

/**
 * 자산 관리 서비스
 *
 * JHAM 자산관리 시스템의 자산(Asset) CRUD 및 생애주기 전체 관리
 * - 자산 등록 → 수정 → 삭제(소프트)
 * - 회사 격리: 모든 조회/수정은 company_id 기준으로 격리
 * - 소프트 삭제: deleted_at 타임스탬프 방식 (물리 삭제 금지)
 * - 외부 ID: UUID(pid) 사용, 내부 정수 PK 외부 노출 금지
 * - 커스텀 필드: 소분류(asset_categories)에 정의된 field_defs에 따라 동적 저장
 * - QR 코드: 자산 등록 시 자동 생성 (자산 UUID 기반)
 *
 * @author JHAM 개발팀
 * @since 2026-05-26
 */
@Service
public class AssetService {

    private static final Logger logger = LoggerFactory.getLogger(AssetService.class);

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
    private QrCodeMapper qrCodeMapper;

    @Autowired
    private QrCodeUtil qrCodeUtil;

    /**
     * 자산 목록 조회
     *
     * 현재 로그인 사용자의 company_id 기준으로 활성 자산만 조회
     * - deleted_at IS NULL 조건 자동 적용
     * - 분류명·부서명·팀명은 JOIN으로 포함하여 반환
     * - 커스텀 필드 값(asset_field_values)도 함께 조회하여 반환
     *
     * @param paramMap 검색 조건 (asset_name, serial_number, category_pid, department_pid,
     *                              team_pid, manager_name)
     * @return 자산 목록 (자산 기본 정보 + 커스텀 필드 포함)
     */
    public HashMap<String, Object> listAssets(HashMap<String, Object> paramMap) {
        HashMap<String, Object> resultMap = new HashMap<>();

        try {
            int companyId = SessionUtil.getCurrentCompanyId();
            paramMap.put("company_id", companyId);

            List<HashMap<String, Object>> assets = assetMapper.selectAssetList(paramMap);

            // 자산별 커스텀 필드 값 조회 후 병합
            List<String> assetIds = new ArrayList<>();
            for (HashMap<String, Object> a : assets) {
                assetIds.add(String.valueOf(a.get("id")));
            }

            if (!assetIds.isEmpty()) {
                HashMap<String, Object> fvParam = new HashMap<>();
                fvParam.put("asset_ids", assetIds);
                fvParam.put("company_id", companyId);
                List<HashMap<String, Object>> fieldValues = fieldValueMapper.selectByAssetIds(fvParam);

                // asset_id 기준으로 커스텀 필드 그룹핑
                HashMap<Integer, List<HashMap<String, Object>>> fvMap = new HashMap<>();
                for (HashMap<String, Object> fv : fieldValues) {
                    int assetId = (int) fv.get("asset_id");
                    fvMap.computeIfAbsent(assetId, k -> new ArrayList<>()).add(fv);
                }
                for (HashMap<String, Object> a : assets) {
                    int assetId = (int) a.get("id");
                    a.put("field_values", fvMap.getOrDefault(assetId, new ArrayList<>()));
                }
            }

            resultMap.put("result_code", "0000");
            resultMap.put("result_msg", "조회 성공");
            resultMap.put("list", assets);
            resultMap.put("total_count", assets.size());

        } catch (Exception e) {
            logger.error("[자산목록] 시스템오류 발생", e);
            resultMap.put("result_code", "ERR_SYS_001");
            resultMap.put("result_msg", "시스템 오류가 발생하였습니다.");
        }

        return resultMap;
    }

    /**
     * 자산 단건 조회
     *
     * UUID(pid)와 company_id로 자산 조회 — 타 회사 자산 접근 불가
     *
     * @param paramMap 조회 조건 (asset_pid)
     * @return 자산 상세 정보 (기본 필드 + 커스텀 필드)
     */
    public HashMap<String, Object> getAsset(HashMap<String, Object> paramMap) {
        HashMap<String, Object> resultMap = new HashMap<>();

        try {
            String assetPid = (String) paramMap.get("asset_pid");
            if (assetPid == null || assetPid.isEmpty()) {
                throw new BizException("ERR_ASSET_001", "자산 UUID가 누락되었습니다.");
            }

            int companyId = SessionUtil.getCurrentCompanyId();
            paramMap.put("company_id", companyId);

            HashMap<String, Object> asset = assetMapper.selectAssetByPidAndCompany(paramMap);
            if (asset == null) {
                throw new BizException("ERR_ASSET_002", "자산을 찾을 수 없습니다.");
            }

            // 커스텀 필드 값 조회
            HashMap<String, Object> fvParam = new HashMap<>();
            fvParam.put("asset_id", asset.get("id"));
            fvParam.put("company_id", companyId);
            List<HashMap<String, Object>> fieldValues = fieldValueMapper.selectByAssetId(fvParam);
            asset.put("field_values", fieldValues);

            resultMap.put("result_code", "0000");
            resultMap.put("result_msg", "조회 성공");
            resultMap.put("asset", asset);

        } catch (BizException e) {
            logger.warn("[자산단건조회] 업무오류 - code: {}, msg: {}", e.getErrorCode(), e.getMessage());
            resultMap.put("result_code", e.getErrorCode());
            resultMap.put("result_msg", e.getMessage());
        } catch (Exception e) {
            logger.error("[자산단건조회] 시스템오류 발생", e);
            resultMap.put("result_code", "ERR_SYS_001");
            resultMap.put("result_msg", "시스템 오류가 발생하였습니다.");
        }

        return resultMap;
    }

    /**
     * 자산 등록
     *
     * 자산 신규 등록 처리
     * - 식별번호(serial_number)는 전체 시스템 고유 (UNIQUE 제약)
     * - 소분류 선택 시 해당 분류에 정의된 커스텀 필드 값을 함께 저장
     * - 등록 완료 후 QR 코드 자동 생성 (자산 UUID 기반 URL 인코딩)
     * - 부서/팀 선택은 선택사항 (null 허용)
     *
     * Guards:
     *   - name(품명) 필수
     *   - serial_number(식별번호) 필수, 중복 불가
     *   - category_pid 유효성 확인 (지정 시)
     *   - department_pid 유효성 확인 (지정 시)
     *   - team_pid 유효성 확인, 선택한 부서 하위 팀이어야 함 (지정 시)
     *
     * @param paramMap 등록 정보 (name, serial_number, location, note, category_pid,
     *                             department_pid, team_pid, manager_name, field_values)
     * @return 등록 결과 (asset_pid)
     */
    @Transactional
    public HashMap<String, Object> registerAsset(HashMap<String, Object> paramMap) {
        HashMap<String, Object> resultMap = new HashMap<>();

        try {
            int companyId = SessionUtil.getCurrentCompanyId();

            // === 필수값 검증 ===
            String name = (String) paramMap.get("name");
            if (name == null || name.trim().isEmpty()) {
                throw new BizException("ERR_ASSET_REG_001", "품명(자산명)은 필수 입력 항목입니다.");
            }

            String serialNumber = (String) paramMap.get("serial_number");
            if (serialNumber == null || serialNumber.trim().isEmpty()) {
                throw new BizException("ERR_ASSET_REG_002", "식별번호는 필수 입력 항목입니다.");
            }

            // === Guard: 식별번호 중복 확인 (전체 고유) ===
            HashMap<String, Object> dupCheckParam = new HashMap<>();
            dupCheckParam.put("serial_number", serialNumber.trim());
            int dupCount = assetMapper.selectSerialNumberDupCount(dupCheckParam);
            if (dupCount > 0) {
                throw new BizException("ERR_ASSET_REG_003",
                        "이미 등록된 식별번호입니다. (식별번호: " + serialNumber + ")");
            }

            // === 분류 유효성 확인 ===
            Integer categoryId = null;
            String categoryPid = (String) paramMap.get("category_pid");
            if (categoryPid != null && !categoryPid.isEmpty()) {
                HashMap<String, Object> catParam = new HashMap<>();
                catParam.put("pid", categoryPid);
                catParam.put("company_id", companyId);
                HashMap<String, Object> category = categoryMapper.selectByPidAndCompany(catParam);
                if (category == null) {
                    throw new BizException("ERR_ASSET_REG_004",
                            "유효하지 않은 자산분류입니다.");
                }
                categoryId = (Integer) category.get("id");
            }

            // === 부서 유효성 확인 ===
            Integer departmentId = null;
            String departmentPid = (String) paramMap.get("department_pid");
            if (departmentPid != null && !departmentPid.isEmpty()) {
                HashMap<String, Object> deptParam = new HashMap<>();
                deptParam.put("pid", departmentPid);
                deptParam.put("company_id", companyId);
                HashMap<String, Object> dept = departmentMapper.selectByPidAndCompany(deptParam);
                if (dept == null) {
                    throw new BizException("ERR_ASSET_REG_005",
                            "유효하지 않은 부서입니다.");
                }
                departmentId = (Integer) dept.get("id");
            }

            // === 팀 유효성 확인 ===
            Integer teamId = null;
            String teamPid = (String) paramMap.get("team_pid");
            if (teamPid != null && !teamPid.isEmpty()) {
                HashMap<String, Object> teamParam = new HashMap<>();
                teamParam.put("pid", teamPid);
                teamParam.put("company_id", companyId);
                HashMap<String, Object> team = teamMapper.selectByPidAndCompany(teamParam);
                if (team == null) {
                    throw new BizException("ERR_ASSET_REG_006",
                            "유효하지 않은 팀입니다.");
                }
                // 선택한 팀이 해당 부서 하위 팀인지 확인
                if (departmentId != null && !departmentId.equals(team.get("department_id"))) {
                    throw new BizException("ERR_ASSET_REG_007",
                            "선택한 팀이 해당 부서 소속이 아닙니다.");
                }
                teamId = (Integer) team.get("id");
            }

            // === 자산 INSERT ===
            HashMap<String, Object> insertParam = new HashMap<>();
            insertParam.put("name", name.trim());
            insertParam.put("serial_number", serialNumber.trim());
            insertParam.put("location", paramMap.get("location"));
            insertParam.put("note", paramMap.get("note"));
            insertParam.put("company_id", companyId);
            insertParam.put("category_id", categoryId);
            insertParam.put("department_id", departmentId);
            insertParam.put("team_id", teamId);
            insertParam.put("manager_name", paramMap.get("manager_name"));
            insertParam.put("created_at", LocalDateTime.now());
            insertParam.put("updated_at", LocalDateTime.now());

            int insertCnt = assetMapper.insertAsset(insertParam);
            if (insertCnt != 1) {
                throw new BizException("ERR_ASSET_REG_008", "자산 등록에 실패하였습니다.");
            }

            int assetId = (int) insertParam.get("id");
            String assetPid = (String) insertParam.get("pid");

            // === 커스텀 필드 값 저장 ===
            List<HashMap<String, Object>> fieldValues =
                    (List<HashMap<String, Object>>) paramMap.getOrDefault("field_values", new ArrayList<>());
            saveFieldValues(assetId, fieldValues, companyId);

            // === QR 코드 자동 생성 ===
            try {
                String qrImagePath = qrCodeUtil.generate(assetPid);
                HashMap<String, Object> qrParam = new HashMap<>();
                qrParam.put("asset_id", assetId);
                qrParam.put("image_path", qrImagePath);
                qrParam.put("created_at", LocalDateTime.now());
                qrCodeMapper.insertQrCode(qrParam);
            } catch (Exception e) {
                // QR 생성 실패는 자산 등록 롤백 없이 경고만 처리
                logger.warn("[자산등록] QR 코드 생성 실패 - asset_pid: {}", assetPid);
            }

            logger.info("[자산등록] 완료 - asset_pid: {}, name: {}, serial_number: {}",
                    assetPid, name, serialNumber);

            resultMap.put("result_code", "0000");
            resultMap.put("result_msg", "자산이 등록되었습니다.");
            resultMap.put("asset_pid", assetPid);

        } catch (BizException e) {
            logger.warn("[자산등록] 업무오류 - code: {}, msg: {}", e.getErrorCode(), e.getMessage());
            resultMap.put("result_code", e.getErrorCode());
            resultMap.put("result_msg", e.getMessage());
        } catch (Exception e) {
            logger.error("[자산등록] 시스템오류 발생", e);
            resultMap.put("result_code", "ERR_SYS_001");
            resultMap.put("result_msg", "시스템 오류가 발생하였습니다.");
        }

        return resultMap;
    }

    /**
     * 자산 수정
     *
     * 기존 자산 정보 수정 — company_id 격리 적용
     * - 식별번호 변경 시 중복 확인 (본인 제외)
     * - 커스텀 필드 값 전체 재저장 (기존 값 삭제 후 재입력)
     * - 분류/부서/팀 변경 가능
     *
     * @param paramMap 수정 정보 (asset_pid, name, serial_number, location, note,
     *                             category_pid, department_pid, team_pid, manager_name, field_values)
     * @return 수정 결과
     */
    @Transactional
    public HashMap<String, Object> updateAsset(HashMap<String, Object> paramMap) {
        HashMap<String, Object> resultMap = new HashMap<>();

        try {
            String assetPid = (String) paramMap.get("asset_pid");
            if (assetPid == null || assetPid.isEmpty()) {
                throw new BizException("ERR_ASSET_UPD_001", "자산 UUID가 누락되었습니다.");
            }

            int companyId = SessionUtil.getCurrentCompanyId();

            // 자산 존재 및 소유 확인
            HashMap<String, Object> findParam = new HashMap<>();
            findParam.put("pid", assetPid);
            findParam.put("company_id", companyId);
            HashMap<String, Object> asset = assetMapper.selectAssetByPidAndCompany(findParam);
            if (asset == null) {
                throw new BizException("ERR_ASSET_UPD_002", "자산을 찾을 수 없습니다.");
            }

            int assetId = (int) asset.get("id");

            // === 필수값 검증 ===
            String name = (String) paramMap.get("name");
            if (name == null || name.trim().isEmpty()) {
                throw new BizException("ERR_ASSET_UPD_003", "품명(자산명)은 필수 입력 항목입니다.");
            }

            String serialNumber = (String) paramMap.get("serial_number");
            if (serialNumber == null || serialNumber.trim().isEmpty()) {
                throw new BizException("ERR_ASSET_UPD_004", "식별번호는 필수 입력 항목입니다.");
            }

            // 식별번호 중복 확인 (본인 제외)
            HashMap<String, Object> dupCheckParam = new HashMap<>();
            dupCheckParam.put("serial_number", serialNumber.trim());
            dupCheckParam.put("exclude_id", assetId);
            int dupCount = assetMapper.selectSerialNumberDupCountExclude(dupCheckParam);
            if (dupCount > 0) {
                throw new BizException("ERR_ASSET_UPD_005",
                        "이미 등록된 식별번호입니다. (식별번호: " + serialNumber + ")");
            }

            // 분류/부서/팀 유효성 확인
            Integer categoryId = resolveCategory(paramMap, companyId);
            Integer departmentId = resolveDepartment(paramMap, companyId);
            Integer teamId = resolveTeam(paramMap, companyId, departmentId);

            // 자산 UPDATE
            HashMap<String, Object> updateParam = new HashMap<>();
            updateParam.put("id", assetId);
            updateParam.put("name", name.trim());
            updateParam.put("serial_number", serialNumber.trim());
            updateParam.put("location", paramMap.get("location"));
            updateParam.put("note", paramMap.get("note"));
            updateParam.put("category_id", categoryId);
            updateParam.put("department_id", departmentId);
            updateParam.put("team_id", teamId);
            updateParam.put("manager_name", paramMap.get("manager_name"));
            updateParam.put("updated_at", LocalDateTime.now());

            assetMapper.updateAsset(updateParam);

            // 커스텀 필드 값 전체 재저장
            List<HashMap<String, Object>> fieldValues =
                    (List<HashMap<String, Object>>) paramMap.getOrDefault("field_values", new ArrayList<>());
            saveFieldValues(assetId, fieldValues, companyId);

            logger.info("[자산수정] 완료 - asset_pid: {}", assetPid);

            resultMap.put("result_code", "0000");
            resultMap.put("result_msg", "자산 정보가 수정되었습니다.");

        } catch (BizException e) {
            logger.warn("[자산수정] 업무오류 - code: {}, msg: {}", e.getErrorCode(), e.getMessage());
            resultMap.put("result_code", e.getErrorCode());
            resultMap.put("result_msg", e.getMessage());
        } catch (Exception e) {
            logger.error("[자산수정] 시스템오류 발생", e);
            resultMap.put("result_code", "ERR_SYS_001");
            resultMap.put("result_msg", "시스템 오류가 발생하였습니다.");
        }

        return resultMap;
    }

    /**
     * 자산 삭제 (소프트 삭제)
     *
     * deleted_at 타임스탬프 설정 방식으로 삭제 처리 — 물리 삭제 금지
     * - QR 코드 이미지 레코드 선삭제 후 자산 소프트 삭제
     * - 삭제된 자산은 목록 조회 시 자동 제외 (deleted_at IS NULL 조건)
     * - company_id 격리: 타 회사 자산 삭제 불가
     *
     * @param paramMap 삭제 정보 (asset_pid)
     * @return 삭제 결과
     */
    @Transactional
    public HashMap<String, Object> deleteAsset(HashMap<String, Object> paramMap) {
        HashMap<String, Object> resultMap = new HashMap<>();

        try {
            String assetPid = (String) paramMap.get("asset_pid");
            if (assetPid == null || assetPid.isEmpty()) {
                throw new BizException("ERR_ASSET_DEL_001", "자산 UUID가 누락되었습니다.");
            }

            int companyId = SessionUtil.getCurrentCompanyId();

            // 자산 존재 및 소유 확인
            HashMap<String, Object> findParam = new HashMap<>();
            findParam.put("pid", assetPid);
            findParam.put("company_id", companyId);
            HashMap<String, Object> asset = assetMapper.selectAssetByPidAndCompany(findParam);
            if (asset == null) {
                throw new BizException("ERR_ASSET_DEL_002", "자산을 찾을 수 없습니다.");
            }

            int assetId = (int) asset.get("id");

            // QR 코드 레코드 선삭제
            HashMap<String, Object> qrParam = new HashMap<>();
            qrParam.put("asset_id", assetId);
            qrCodeMapper.deleteByAssetId(qrParam);

            // 자산 소프트 삭제 (deleted_at 설정)
            HashMap<String, Object> deleteParam = new HashMap<>();
            deleteParam.put("id", assetId);
            deleteParam.put("deleted_at", LocalDateTime.now());
            deleteParam.put("updated_at", LocalDateTime.now());
            assetMapper.softDeleteAsset(deleteParam);

            logger.info("[자산삭제] 소프트삭제 완료 - asset_pid: {}, asset_id: {}",
                    assetPid, assetId);

            resultMap.put("result_code", "0000");
            resultMap.put("result_msg", "자산이 삭제되었습니다.");

        } catch (BizException e) {
            logger.warn("[자산삭제] 업무오류 - code: {}, msg: {}", e.getErrorCode(), e.getMessage());
            resultMap.put("result_code", e.getErrorCode());
            resultMap.put("result_msg", e.getMessage());
        } catch (Exception e) {
            logger.error("[자산삭제] 시스템오류 발생", e);
            resultMap.put("result_code", "ERR_SYS_001");
            resultMap.put("result_msg", "시스템 오류가 발생하였습니다.");
        }

        return resultMap;
    }

    /**
     * 사진 업로드
     *
     * 자산 대표 사진 저장 — 이미지 파일만 허용 (jpg/png/gif/webp)
     * - uploads/photos/{asset_uuid}.{ext} 경로에 저장
     * - 기존 사진이 있는 경우 덮어쓰기
     *
     * @param paramMap 업로드 정보 (asset_pid, file_bytes, content_type)
     * @return 업로드 결과 (photo_path)
     */
    @Transactional
    public HashMap<String, Object> uploadPhoto(HashMap<String, Object> paramMap) {
        HashMap<String, Object> resultMap = new HashMap<>();

        try {
            String assetPid = (String) paramMap.get("asset_pid");
            if (assetPid == null || assetPid.isEmpty()) {
                throw new BizException("ERR_ASSET_PHT_001", "자산 UUID가 누락되었습니다.");
            }

            String contentType = (String) paramMap.getOrDefault("content_type", "");
            if (!contentType.startsWith("image/")) {
                throw new BizException("ERR_ASSET_PHT_002", "이미지 파일만 업로드 가능합니다.");
            }

            int companyId = SessionUtil.getCurrentCompanyId();

            HashMap<String, Object> findParam = new HashMap<>();
            findParam.put("pid", assetPid);
            findParam.put("company_id", companyId);
            HashMap<String, Object> asset = assetMapper.selectAssetByPidAndCompany(findParam);
            if (asset == null) {
                throw new BizException("ERR_ASSET_PHT_003", "자산을 찾을 수 없습니다.");
            }

            // 확장자 결정
            String ext;
            switch (contentType) {
                case "image/png":  ext = "png";  break;
                case "image/gif":  ext = "gif";  break;
                case "image/webp": ext = "webp"; break;
                default:           ext = "jpg";  break;
            }

            // 파일 저장 (uploads/photos/{pid}.{ext})
            byte[] fileBytes = (byte[]) paramMap.get("file_bytes");
            String photoPath = "uploads/photos/" + assetPid + "." + ext;
            saveFile(photoPath, fileBytes);

            // photo_path 업데이트
            HashMap<String, Object> updateParam = new HashMap<>();
            updateParam.put("id", asset.get("id"));
            updateParam.put("photo_path", photoPath);
            updateParam.put("updated_at", LocalDateTime.now());
            assetMapper.updatePhotoPath(updateParam);

            logger.info("[사진업로드] 완료 - asset_pid: {}, path: {}", assetPid, photoPath);

            resultMap.put("result_code", "0000");
            resultMap.put("result_msg", "사진이 업로드되었습니다.");
            resultMap.put("photo_path", photoPath);

        } catch (BizException e) {
            logger.warn("[사진업로드] 업무오류 - code: {}, msg: {}", e.getErrorCode(), e.getMessage());
            resultMap.put("result_code", e.getErrorCode());
            resultMap.put("result_msg", e.getMessage());
        } catch (Exception e) {
            logger.error("[사진업로드] 시스템오류 발생", e);
            resultMap.put("result_code", "ERR_SYS_001");
            resultMap.put("result_msg", "시스템 오류가 발생하였습니다.");
        }

        return resultMap;
    }

    /* ========== Private Helper Methods ========== */

    /**
     * 커스텀 필드 값 저장 — 기존 값 전체 삭제 후 재입력
     *
     * field_def_pid 기준으로 field_def_id를 조회하여 저장
     * 값이 비어있는 필드는 저장 제외
     */
    private void saveFieldValues(int assetId, List<HashMap<String, Object>> fieldValues, int companyId) {
        // 기존 커스텀 필드 값 전체 삭제
        HashMap<String, Object> delParam = new HashMap<>();
        delParam.put("asset_id", assetId);
        fieldValueMapper.deleteByAssetId(delParam);

        if (fieldValues == null || fieldValues.isEmpty()) {
            return;
        }

        // 해당 회사의 field_def 목록 조회 (pid → id 매핑용)
        HashMap<String, Object> defParam = new HashMap<>();
        defParam.put("company_id", companyId);
        List<HashMap<String, Object>> defs = fieldDefMapper.selectByCompany(defParam);

        HashMap<String, Integer> defPidToId = new HashMap<>();
        for (HashMap<String, Object> def : defs) {
            defPidToId.put((String) def.get("pid"), (Integer) def.get("id"));
        }

        // 커스텀 필드 값 개별 INSERT
        for (HashMap<String, Object> fv : fieldValues) {
            String fieldDefPid = (String) fv.get("field_def_pid");
            String value = (String) fv.get("value");

            if (fieldDefPid == null || value == null || value.trim().isEmpty()) {
                continue;
            }

            Integer fieldDefId = defPidToId.get(fieldDefPid);
            if (fieldDefId == null) {
                logger.warn("[커스텀필드저장] 존재하지 않는 field_def_pid: {}", fieldDefPid);
                continue;
            }

            HashMap<String, Object> insertFvParam = new HashMap<>();
            insertFvParam.put("asset_id", assetId);
            insertFvParam.put("field_def_id", fieldDefId);
            insertFvParam.put("value", value.trim());
            insertFvParam.put("created_at", LocalDateTime.now());
            insertFvParam.put("updated_at", LocalDateTime.now());
            fieldValueMapper.insertFieldValue(insertFvParam);
        }
    }

    /** 분류 PID → ID 변환 및 유효성 확인 */
    private Integer resolveCategory(HashMap<String, Object> paramMap, int companyId) {
        String pid = (String) paramMap.get("category_pid");
        if (pid == null || pid.isEmpty()) return null;

        HashMap<String, Object> catParam = new HashMap<>();
        catParam.put("pid", pid);
        catParam.put("company_id", companyId);
        HashMap<String, Object> cat = categoryMapper.selectByPidAndCompany(catParam);
        if (cat == null) throw new BizException("ERR_ASSET_CAT_001", "유효하지 않은 자산분류입니다.");
        return (Integer) cat.get("id");
    }

    /** 부서 PID → ID 변환 및 유효성 확인 */
    private Integer resolveDepartment(HashMap<String, Object> paramMap, int companyId) {
        String pid = (String) paramMap.get("department_pid");
        if (pid == null || pid.isEmpty()) return null;

        HashMap<String, Object> deptParam = new HashMap<>();
        deptParam.put("pid", pid);
        deptParam.put("company_id", companyId);
        HashMap<String, Object> dept = departmentMapper.selectByPidAndCompany(deptParam);
        if (dept == null) throw new BizException("ERR_ASSET_DEPT_001", "유효하지 않은 부서입니다.");
        return (Integer) dept.get("id");
    }

    /** 팀 PID → ID 변환, 부서 소속 여부 확인 */
    private Integer resolveTeam(HashMap<String, Object> paramMap, int companyId, Integer departmentId) {
        String pid = (String) paramMap.get("team_pid");
        if (pid == null || pid.isEmpty()) return null;

        HashMap<String, Object> teamParam = new HashMap<>();
        teamParam.put("pid", pid);
        teamParam.put("company_id", companyId);
        HashMap<String, Object> team = teamMapper.selectByPidAndCompany(teamParam);
        if (team == null) throw new BizException("ERR_ASSET_TEAM_001", "유효하지 않은 팀입니다.");
        if (departmentId != null && !departmentId.equals(team.get("department_id"))) {
            throw new BizException("ERR_ASSET_TEAM_002", "선택한 팀이 해당 부서 소속이 아닙니다.");
        }
        return (Integer) team.get("id");
    }

    /** 파일 저장 (실제 구현은 스토리지 설정에 따라 변경) */
    private void saveFile(String path, byte[] bytes) throws Exception {
        java.nio.file.Path filePath = java.nio.file.Paths.get(path);
        java.nio.file.Files.createDirectories(filePath.getParent());
        java.nio.file.Files.write(filePath, bytes);
    }
}
