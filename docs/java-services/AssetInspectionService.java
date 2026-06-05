package com.jham.asset.service;

import com.jham.asset.mapper.AssetInspectionMapper;
import com.jham.asset.mapper.AssetMapper;
import com.jham.asset.mapper.InspectionTemplateMapper;
import com.jham.asset.util.BizException;
import com.jham.asset.util.SessionUtil;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;

/**
 * 자산 점검 관리 서비스
 *
 * 자산 점검 이력 등록·수정·삭제 및 점검 기본입력사항 템플릿 관리
 *
 * 점검 유형:
 *   - 일반점검: 단일 점검일자(inspection_date) 기준
 *   - 기간점검: 점검 시작일(period_start) ~ 종료일(period_end) 범위
 *
 * 점검 결과 코드:
 *   - 점검완료    정상 점검 완료
 *   - 재점검필요  이상 발견으로 재점검 필요
 *   - 폐기처리   자산 폐기 결정
 *   - 기타       기타 사유
 *
 * 소프트 삭제: deleted_at 방식 (물리 삭제 금지)
 * 공개 API: QR 코드 스캔 → 인증 없이 점검 등록 가능 (asset_pid 기반)
 *
 * @author JHAM 개발팀
 * @since 2026-05-26
 */
@Service
public class AssetInspectionService {

    private static final Logger logger = LoggerFactory.getLogger(AssetInspectionService.class);

    /** 점검 유형 코드 */
    public static final String TYPE_GENERAL = "일반점검";
    public static final String TYPE_PERIOD  = "기간점검";

    /** 점검 결과 코드 */
    public static final String RESULT_COMPLETED  = "점검완료";
    public static final String RESULT_REINSPECT  = "재점검필요";
    public static final String RESULT_DISPOSED   = "폐기처리";
    public static final String RESULT_ETC        = "기타";

    @Autowired
    private AssetInspectionMapper inspectionMapper;

    @Autowired
    private AssetMapper assetMapper;

    @Autowired
    private InspectionTemplateMapper templateMapper;

    /**
     * 점검 이력 목록 조회
     *
     * 검색 조건으로 점검 이력 조회 — company_id 격리 적용
     * - 자산명·부서·팀·점검유형·점검결과·기간 복합 검색 지원
     * - 삭제된 점검(deleted_at IS NOT NULL) 제외
     *
     * @param paramMap 검색 조건 (asset_name, department_pid, team_pid,
     *                             inspection_type, inspection_result,
     *                             date_from, date_to)
     * @return 점검 이력 목록
     */
    public HashMap<String, Object> listInspections(HashMap<String, Object> paramMap) {
        HashMap<String, Object> resultMap = new HashMap<>();

        try {
            int companyId = SessionUtil.getCurrentCompanyId();
            paramMap.put("company_id", companyId);

            List<HashMap<String, Object>> list = inspectionMapper.selectInspectionList(paramMap);

            resultMap.put("result_code", "0000");
            resultMap.put("result_msg", "조회 성공");
            resultMap.put("list", list);
            resultMap.put("total_count", list.size());

        } catch (Exception e) {
            logger.error("[점검목록] 시스템오류 발생", e);
            resultMap.put("result_code", "ERR_SYS_001");
            resultMap.put("result_msg", "시스템 오류가 발생하였습니다.");
        }

        return resultMap;
    }

    /**
     * 자산별 점검 이력 조회
     *
     * 특정 자산의 점검 이력 전체 조회 — company_id 격리 적용
     *
     * @param paramMap 조회 조건 (asset_pid)
     * @return 해당 자산의 점검 이력 목록
     */
    public HashMap<String, Object> listInspectionsByAsset(HashMap<String, Object> paramMap) {
        HashMap<String, Object> resultMap = new HashMap<>();

        try {
            String assetPid = (String) paramMap.get("asset_pid");
            if (assetPid == null || assetPid.isEmpty()) {
                throw new BizException("ERR_INSP_LST_001", "자산 UUID가 누락되었습니다.");
            }

            int companyId = SessionUtil.getCurrentCompanyId();

            // 자산 존재 및 소유 확인
            HashMap<String, Object> findParam = new HashMap<>();
            findParam.put("pid", assetPid);
            findParam.put("company_id", companyId);
            HashMap<String, Object> asset = assetMapper.selectAssetByPidAndCompany(findParam);
            if (asset == null) {
                throw new BizException("ERR_INSP_LST_002", "자산을 찾을 수 없습니다.");
            }

            HashMap<String, Object> listParam = new HashMap<>();
            listParam.put("asset_id", asset.get("id"));
            List<HashMap<String, Object>> list = inspectionMapper.selectByAssetId(listParam);

            resultMap.put("result_code", "0000");
            resultMap.put("result_msg", "조회 성공");
            resultMap.put("list", list);

        } catch (BizException e) {
            logger.warn("[자산별점검조회] 업무오류 - code: {}, msg: {}", e.getErrorCode(), e.getMessage());
            resultMap.put("result_code", e.getErrorCode());
            resultMap.put("result_msg", e.getMessage());
        } catch (Exception e) {
            logger.error("[자산별점검조회] 시스템오류 발생", e);
            resultMap.put("result_code", "ERR_SYS_001");
            resultMap.put("result_msg", "시스템 오류가 발생하였습니다.");
        }

        return resultMap;
    }

    /**
     * 점검 등록 (인증 필요 — 관리자 화면)
     *
     * 인증된 사용자가 자산에 점검 이력 등록
     * - company_id 격리: 본인 회사 자산만 점검 등록 가능
     * - 점검유형별 날짜 필드 유효성 검증
     *   : 일반점검 → inspection_date 필수
     *   : 기간점검 → period_start, period_end 필수 / period_end >= period_start
     *
     * Guards:
     *   - asset_pid 필수
     *   - inspector_name 필수
     *   - inspection_type 필수 (일반점검 / 기간점검)
     *   - 일반점검: inspection_date 필수
     *   - 기간점검: period_start, period_end 필수, 종료일 >= 시작일
     *
     * @param paramMap 점검 정보 (asset_pid, inspector_name, inspection_type,
     *                             inspection_result, inspection_date,
     *                             period_start, period_end, note, remarks)
     * @return 등록 결과 (inspection_pid)
     */
    @Transactional
    public HashMap<String, Object> registerInspection(HashMap<String, Object> paramMap) {
        HashMap<String, Object> resultMap = new HashMap<>();

        try {
            String assetPid = (String) paramMap.get("asset_pid");
            if (assetPid == null || assetPid.isEmpty()) {
                throw new BizException("ERR_INSP_REG_001", "자산 UUID가 누락되었습니다.");
            }

            String inspectorName = (String) paramMap.get("inspector_name");
            if (inspectorName == null || inspectorName.trim().isEmpty()) {
                throw new BizException("ERR_INSP_REG_002", "점검자명은 필수 입력 항목입니다.");
            }

            String inspectionType = (String) paramMap.get("inspection_type");
            if (inspectionType == null || inspectionType.trim().isEmpty()) {
                throw new BizException("ERR_INSP_REG_003", "점검유형은 필수 선택 항목입니다.");
            }
            if (!TYPE_GENERAL.equals(inspectionType) && !TYPE_PERIOD.equals(inspectionType)) {
                throw new BizException("ERR_INSP_REG_004",
                        "유효하지 않은 점검유형입니다. (일반점검 / 기간점검)");
            }

            int companyId = SessionUtil.getCurrentCompanyId();

            // 자산 존재 및 소유 확인
            HashMap<String, Object> findParam = new HashMap<>();
            findParam.put("pid", assetPid);
            findParam.put("company_id", companyId);
            HashMap<String, Object> asset = assetMapper.selectAssetByPidAndCompany(findParam);
            if (asset == null) {
                throw new BizException("ERR_INSP_REG_005", "자산을 찾을 수 없습니다.");
            }

            // 점검유형별 날짜 유효성 검증
            LocalDate inspectionDate = null;
            LocalDate periodStart    = null;
            LocalDate periodEnd      = null;

            if (TYPE_GENERAL.equals(inspectionType)) {
                // 일반점검: inspection_date 필수
                String dateStr = (String) paramMap.get("inspection_date");
                if (dateStr == null || dateStr.trim().isEmpty()) {
                    throw new BizException("ERR_INSP_REG_006", "일반점검은 점검일자가 필수입니다.");
                }
                inspectionDate = LocalDate.parse(dateStr);

            } else {
                // 기간점검: period_start, period_end 필수 / 종료일 >= 시작일
                String startStr = (String) paramMap.get("period_start");
                String endStr   = (String) paramMap.get("period_end");

                if (startStr == null || startStr.trim().isEmpty()) {
                    throw new BizException("ERR_INSP_REG_007", "기간점검은 시작일이 필수입니다.");
                }
                if (endStr == null || endStr.trim().isEmpty()) {
                    throw new BizException("ERR_INSP_REG_008", "기간점검은 종료일이 필수입니다.");
                }

                periodStart = LocalDate.parse(startStr);
                periodEnd   = LocalDate.parse(endStr);

                if (periodEnd.isBefore(periodStart)) {
                    throw new BizException("ERR_INSP_REG_009",
                            "종료일은 시작일보다 같거나 이후여야 합니다.");
                }
            }

            // 점검 결과 유효성 확인 (입력된 경우)
            String inspectionResult = (String) paramMap.get("inspection_result");
            if (inspectionResult != null && !inspectionResult.trim().isEmpty()) {
                if (!RESULT_COMPLETED.equals(inspectionResult)
                        && !RESULT_REINSPECT.equals(inspectionResult)
                        && !RESULT_DISPOSED.equals(inspectionResult)
                        && !RESULT_ETC.equals(inspectionResult)) {
                    throw new BizException("ERR_INSP_REG_010",
                            "유효하지 않은 점검결과입니다. (점검완료 / 재점검필요 / 폐기처리 / 기타)");
                }
            }

            // 점검 이력 INSERT
            HashMap<String, Object> insertParam = new HashMap<>();
            insertParam.put("asset_id", asset.get("id"));
            insertParam.put("inspector_name", inspectorName.trim());
            insertParam.put("inspection_type", inspectionType);
            insertParam.put("inspection_result", inspectionResult);
            insertParam.put("inspection_date", inspectionDate);
            insertParam.put("period_start", periodStart);
            insertParam.put("period_end", periodEnd);
            insertParam.put("note", paramMap.get("note"));
            insertParam.put("remarks", paramMap.get("remarks"));
            insertParam.put("created_at", LocalDateTime.now());
            insertParam.put("updated_at", LocalDateTime.now());

            inspectionMapper.insertInspection(insertParam);
            String inspectionPid = (String) insertParam.get("pid");

            logger.info("[점검등록] 완료 - inspection_pid: {}, asset_pid: {}, type: {}",
                    inspectionPid, assetPid, inspectionType);

            resultMap.put("result_code", "0000");
            resultMap.put("result_msg", "점검이 등록되었습니다.");
            resultMap.put("inspection_pid", inspectionPid);

        } catch (BizException e) {
            logger.warn("[점검등록] 업무오류 - code: {}, msg: {}", e.getErrorCode(), e.getMessage());
            resultMap.put("result_code", e.getErrorCode());
            resultMap.put("result_msg", e.getMessage());
        } catch (Exception e) {
            logger.error("[점검등록] 시스템오류 발생", e);
            resultMap.put("result_code", "ERR_SYS_001");
            resultMap.put("result_msg", "시스템 오류가 발생하였습니다.");
        }

        return resultMap;
    }

    /**
     * 점검 등록 (공개 API — QR 코드 스캔)
     *
     * QR 코드 스캔 후 인증 없이 점검 등록 (현장 점검 지원)
     * - JWT 인증 불필요 — asset_pid만으로 자산 특정
     * - 등록 권한 격리 없음 (스캔한 누구나 등록 가능)
     * - 점검유형 기본값: 일반점검
     *
     * @param paramMap 점검 정보 (asset_pid, inspector_name, inspection_type,
     *                             inspection_result, inspection_date,
     *                             period_start, period_end, note, remarks)
     * @return 등록 결과
     */
    @Transactional
    public HashMap<String, Object> registerPublicInspection(HashMap<String, Object> paramMap) {
        HashMap<String, Object> resultMap = new HashMap<>();

        try {
            String assetPid = (String) paramMap.get("asset_pid");
            if (assetPid == null || assetPid.isEmpty()) {
                throw new BizException("ERR_INSP_PUB_001", "자산 UUID가 누락되었습니다.");
            }

            String inspectorName = (String) paramMap.get("inspector_name");
            if (inspectorName == null || inspectorName.trim().isEmpty()) {
                throw new BizException("ERR_INSP_PUB_002", "점검자명은 필수 입력 항목입니다.");
            }

            // 공개 API: pid만으로 자산 조회 (company_id 무관)
            HashMap<String, Object> findParam = new HashMap<>();
            findParam.put("pid", assetPid);
            HashMap<String, Object> asset = assetMapper.selectAssetByPid(findParam);
            if (asset == null) {
                throw new BizException("ERR_INSP_PUB_003", "자산을 찾을 수 없습니다.");
            }

            String inspectionType = (String) paramMap.getOrDefault("inspection_type", TYPE_GENERAL);

            // 날짜 유효성 검증 (registerInspection과 동일 규칙 적용)
            LocalDate inspectionDate = null;
            LocalDate periodStart    = null;
            LocalDate periodEnd      = null;

            if (TYPE_GENERAL.equals(inspectionType)) {
                String dateStr = (String) paramMap.get("inspection_date");
                if (dateStr != null && !dateStr.trim().isEmpty()) {
                    inspectionDate = LocalDate.parse(dateStr);
                }
            } else if (TYPE_PERIOD.equals(inspectionType)) {
                String startStr = (String) paramMap.get("period_start");
                String endStr   = (String) paramMap.get("period_end");
                if (startStr != null) periodStart = LocalDate.parse(startStr);
                if (endStr   != null) periodEnd   = LocalDate.parse(endStr);
                if (periodStart != null && periodEnd != null && periodEnd.isBefore(periodStart)) {
                    throw new BizException("ERR_INSP_PUB_004",
                            "종료일은 시작일보다 같거나 이후여야 합니다.");
                }
            }

            HashMap<String, Object> insertParam = new HashMap<>();
            insertParam.put("asset_id", asset.get("id"));
            insertParam.put("inspector_name", inspectorName.trim());
            insertParam.put("inspection_type", inspectionType);
            insertParam.put("inspection_result", paramMap.get("inspection_result"));
            insertParam.put("inspection_date", inspectionDate);
            insertParam.put("period_start", periodStart);
            insertParam.put("period_end", periodEnd);
            insertParam.put("note", paramMap.get("note"));
            insertParam.put("remarks", paramMap.get("remarks"));
            insertParam.put("created_at", LocalDateTime.now());
            insertParam.put("updated_at", LocalDateTime.now());

            inspectionMapper.insertInspection(insertParam);
            String inspectionPid = (String) insertParam.get("pid");

            logger.info("[공개점검등록] 완료 - inspection_pid: {}, asset_pid: {}",
                    inspectionPid, assetPid);

            resultMap.put("result_code", "0000");
            resultMap.put("result_msg", "점검이 등록되었습니다.");
            resultMap.put("inspection_pid", inspectionPid);

        } catch (BizException e) {
            logger.warn("[공개점검등록] 업무오류 - code: {}, msg: {}", e.getErrorCode(), e.getMessage());
            resultMap.put("result_code", e.getErrorCode());
            resultMap.put("result_msg", e.getMessage());
        } catch (Exception e) {
            logger.error("[공개점검등록] 시스템오류 발생", e);
            resultMap.put("result_code", "ERR_SYS_001");
            resultMap.put("result_msg", "시스템 오류가 발생하였습니다.");
        }

        return resultMap;
    }

    /**
     * 점검 수정
     *
     * 기존 점검 이력 수정 — company_id 격리 적용
     * - 점검유형 변경 가능 (유형 변경 시 날짜 필드 재검증)
     *
     * @param paramMap 수정 정보 (inspection_pid, inspector_name, inspection_type,
     *                             inspection_result, inspection_date,
     *                             period_start, period_end, note, remarks)
     * @return 수정 결과
     */
    @Transactional
    public HashMap<String, Object> updateInspection(HashMap<String, Object> paramMap) {
        HashMap<String, Object> resultMap = new HashMap<>();

        try {
            String inspectionPid = (String) paramMap.get("inspection_pid");
            if (inspectionPid == null || inspectionPid.isEmpty()) {
                throw new BizException("ERR_INSP_UPD_001", "점검 UUID가 누락되었습니다.");
            }

            int companyId = SessionUtil.getCurrentCompanyId();

            // 점검 이력 존재 확인 (company_id를 통한 자산 소유 확인 포함)
            HashMap<String, Object> findParam = new HashMap<>();
            findParam.put("pid", inspectionPid);
            findParam.put("company_id", companyId);
            HashMap<String, Object> inspection = inspectionMapper.selectByPidAndCompany(findParam);
            if (inspection == null) {
                throw new BizException("ERR_INSP_UPD_002", "점검 이력을 찾을 수 없습니다.");
            }

            String inspectorName = (String) paramMap.get("inspector_name");
            if (inspectorName == null || inspectorName.trim().isEmpty()) {
                throw new BizException("ERR_INSP_UPD_003", "점검자명은 필수 입력 항목입니다.");
            }

            String inspectionType = (String) paramMap.get("inspection_type");
            if (inspectionType == null || inspectionType.trim().isEmpty()) {
                throw new BizException("ERR_INSP_UPD_004", "점검유형은 필수 선택 항목입니다.");
            }

            // 날짜 유효성 검증
            LocalDate inspectionDate = null;
            LocalDate periodStart    = null;
            LocalDate periodEnd      = null;

            if (TYPE_GENERAL.equals(inspectionType)) {
                String dateStr = (String) paramMap.get("inspection_date");
                if (dateStr == null || dateStr.trim().isEmpty()) {
                    throw new BizException("ERR_INSP_UPD_005", "일반점검은 점검일자가 필수입니다.");
                }
                inspectionDate = LocalDate.parse(dateStr);
            } else if (TYPE_PERIOD.equals(inspectionType)) {
                String startStr = (String) paramMap.get("period_start");
                String endStr   = (String) paramMap.get("period_end");
                if (startStr == null || startStr.trim().isEmpty()) {
                    throw new BizException("ERR_INSP_UPD_006", "기간점검은 시작일이 필수입니다.");
                }
                if (endStr == null || endStr.trim().isEmpty()) {
                    throw new BizException("ERR_INSP_UPD_007", "기간점검은 종료일이 필수입니다.");
                }
                periodStart = LocalDate.parse(startStr);
                periodEnd   = LocalDate.parse(endStr);
                if (periodEnd.isBefore(periodStart)) {
                    throw new BizException("ERR_INSP_UPD_008",
                            "종료일은 시작일보다 같거나 이후여야 합니다.");
                }
            }

            HashMap<String, Object> updateParam = new HashMap<>();
            updateParam.put("id", inspection.get("id"));
            updateParam.put("inspector_name", inspectorName.trim());
            updateParam.put("inspection_type", inspectionType);
            updateParam.put("inspection_result", paramMap.get("inspection_result"));
            updateParam.put("inspection_date", inspectionDate);
            updateParam.put("period_start", periodStart);
            updateParam.put("period_end", periodEnd);
            updateParam.put("note", paramMap.get("note"));
            updateParam.put("remarks", paramMap.get("remarks"));
            updateParam.put("updated_at", LocalDateTime.now());

            inspectionMapper.updateInspection(updateParam);

            logger.info("[점검수정] 완료 - inspection_pid: {}", inspectionPid);

            resultMap.put("result_code", "0000");
            resultMap.put("result_msg", "점검 이력이 수정되었습니다.");

        } catch (BizException e) {
            logger.warn("[점검수정] 업무오류 - code: {}, msg: {}", e.getErrorCode(), e.getMessage());
            resultMap.put("result_code", e.getErrorCode());
            resultMap.put("result_msg", e.getMessage());
        } catch (Exception e) {
            logger.error("[점검수정] 시스템오류 발생", e);
            resultMap.put("result_code", "ERR_SYS_001");
            resultMap.put("result_msg", "시스템 오류가 발생하였습니다.");
        }

        return resultMap;
    }

    /**
     * 점검 이력 삭제 (소프트 삭제)
     *
     * deleted_at 설정 방식 — 물리 삭제 금지
     * - company_id 격리: 본인 회사 자산의 점검만 삭제 가능
     *
     * @param paramMap 삭제 정보 (inspection_pid)
     * @return 삭제 결과
     */
    @Transactional
    public HashMap<String, Object> deleteInspection(HashMap<String, Object> paramMap) {
        HashMap<String, Object> resultMap = new HashMap<>();

        try {
            String inspectionPid = (String) paramMap.get("inspection_pid");
            if (inspectionPid == null || inspectionPid.isEmpty()) {
                throw new BizException("ERR_INSP_DEL_001", "점검 UUID가 누락되었습니다.");
            }

            int companyId = SessionUtil.getCurrentCompanyId();

            HashMap<String, Object> findParam = new HashMap<>();
            findParam.put("pid", inspectionPid);
            findParam.put("company_id", companyId);
            HashMap<String, Object> inspection = inspectionMapper.selectByPidAndCompany(findParam);
            if (inspection == null) {
                throw new BizException("ERR_INSP_DEL_002", "점검 이력을 찾을 수 없습니다.");
            }

            HashMap<String, Object> deleteParam = new HashMap<>();
            deleteParam.put("id", inspection.get("id"));
            deleteParam.put("deleted_at", LocalDateTime.now());
            deleteParam.put("updated_at", LocalDateTime.now());
            inspectionMapper.softDeleteInspection(deleteParam);

            logger.info("[점검삭제] 소프트삭제 완료 - inspection_pid: {}", inspectionPid);

            resultMap.put("result_code", "0000");
            resultMap.put("result_msg", "점검 이력이 삭제되었습니다.");

        } catch (BizException e) {
            logger.warn("[점검삭제] 업무오류 - code: {}, msg: {}", e.getErrorCode(), e.getMessage());
            resultMap.put("result_code", e.getErrorCode());
            resultMap.put("result_msg", e.getMessage());
        } catch (Exception e) {
            logger.error("[점검삭제] 시스템오류 발생", e);
            resultMap.put("result_code", "ERR_SYS_001");
            resultMap.put("result_msg", "시스템 오류가 발생하였습니다.");
        }

        return resultMap;
    }

    /**
     * 점검 기본입력사항 템플릿 목록 조회
     *
     * 현재 로그인 사용자(user_id)의 템플릿만 조회
     * - company_id + user_id 복합 격리 적용
     * - sort_order 오름차순 정렬
     *
     * @return 템플릿 목록
     */
    public HashMap<String, Object> listTemplates() {
        HashMap<String, Object> resultMap = new HashMap<>();

        try {
            int companyId = SessionUtil.getCurrentCompanyId();
            int userId    = SessionUtil.getCurrentUserId();

            HashMap<String, Object> param = new HashMap<>();
            param.put("company_id", companyId);
            param.put("user_id", userId);

            List<HashMap<String, Object>> list = templateMapper.selectTemplateList(param);

            resultMap.put("result_code", "0000");
            resultMap.put("result_msg", "조회 성공");
            resultMap.put("list", list);

        } catch (Exception e) {
            logger.error("[템플릿목록] 시스템오류 발생", e);
            resultMap.put("result_code", "ERR_SYS_001");
            resultMap.put("result_msg", "시스템 오류가 발생하였습니다.");
        }

        return resultMap;
    }

    /**
     * 점검 기본입력사항 템플릿 저장 (등록 or 수정)
     *
     * template_pid 포함 시 수정, 미포함 시 신규 등록
     * - 사용자별 독립 관리 (다른 사용자 템플릿 수정 불가)
     * - sort_order로 목록 표시 순서 설정 가능
     *
     * @param paramMap 템플릿 정보 (template_pid(수정 시), title, inspection_type,
     *                             inspection_result, inspector_name, note, remarks, sort_order)
     * @return 저장 결과 (template_pid)
     */
    @Transactional
    public HashMap<String, Object> saveTemplate(HashMap<String, Object> paramMap) {
        HashMap<String, Object> resultMap = new HashMap<>();

        try {
            int companyId = SessionUtil.getCurrentCompanyId();
            int userId    = SessionUtil.getCurrentUserId();

            String title = (String) paramMap.get("title");
            if (title == null || title.trim().isEmpty()) {
                throw new BizException("ERR_TMPL_001", "템플릿 제목은 필수 입력 항목입니다.");
            }

            String inspectionType = (String) paramMap.get("inspection_type");
            if (inspectionType == null || inspectionType.trim().isEmpty()) {
                throw new BizException("ERR_TMPL_002", "점검유형은 필수 선택 항목입니다.");
            }

            String templatePid = (String) paramMap.get("template_pid");

            if (templatePid != null && !templatePid.isEmpty()) {
                // === 수정 ===
                HashMap<String, Object> findParam = new HashMap<>();
                findParam.put("pid", templatePid);
                findParam.put("company_id", companyId);
                findParam.put("user_id", userId);
                HashMap<String, Object> template = templateMapper.selectByPidAndUser(findParam);
                if (template == null) {
                    throw new BizException("ERR_TMPL_003", "템플릿을 찾을 수 없습니다.");
                }

                HashMap<String, Object> updateParam = new HashMap<>();
                updateParam.put("id", template.get("id"));
                updateParam.put("title", title.trim());
                updateParam.put("inspection_type", inspectionType);
                updateParam.put("inspection_result", paramMap.get("inspection_result"));
                updateParam.put("inspector_name", paramMap.get("inspector_name"));
                updateParam.put("note", paramMap.get("note"));
                updateParam.put("remarks", paramMap.get("remarks"));
                updateParam.put("sort_order", paramMap.getOrDefault("sort_order", 0));
                updateParam.put("updated_at", LocalDateTime.now());
                templateMapper.updateTemplate(updateParam);

                logger.info("[템플릿수정] 완료 - template_pid: {}", templatePid);
                resultMap.put("result_msg", "템플릿이 수정되었습니다.");
                resultMap.put("template_pid", templatePid);

            } else {
                // === 신규 등록 ===
                HashMap<String, Object> insertParam = new HashMap<>();
                insertParam.put("company_id", companyId);
                insertParam.put("user_id", userId);
                insertParam.put("title", title.trim());
                insertParam.put("inspection_type", inspectionType);
                insertParam.put("inspection_result", paramMap.get("inspection_result"));
                insertParam.put("inspector_name", paramMap.get("inspector_name"));
                insertParam.put("note", paramMap.get("note"));
                insertParam.put("remarks", paramMap.get("remarks"));
                insertParam.put("sort_order", paramMap.getOrDefault("sort_order", 0));
                insertParam.put("created_at", LocalDateTime.now());
                insertParam.put("updated_at", LocalDateTime.now());
                templateMapper.insertTemplate(insertParam);

                templatePid = (String) insertParam.get("pid");
                logger.info("[템플릿등록] 완료 - template_pid: {}", templatePid);
                resultMap.put("result_msg", "템플릿이 저장되었습니다.");
                resultMap.put("template_pid", templatePid);
            }

            resultMap.put("result_code", "0000");

        } catch (BizException e) {
            logger.warn("[템플릿저장] 업무오류 - code: {}, msg: {}", e.getErrorCode(), e.getMessage());
            resultMap.put("result_code", e.getErrorCode());
            resultMap.put("result_msg", e.getMessage());
        } catch (Exception e) {
            logger.error("[템플릿저장] 시스템오류 발생", e);
            resultMap.put("result_code", "ERR_SYS_001");
            resultMap.put("result_msg", "시스템 오류가 발생하였습니다.");
        }

        return resultMap;
    }

    /**
     * 점검 기본입력사항 템플릿 삭제 (소프트 삭제)
     *
     * @param paramMap 삭제 정보 (template_pid)
     * @return 삭제 결과
     */
    @Transactional
    public HashMap<String, Object> deleteTemplate(HashMap<String, Object> paramMap) {
        HashMap<String, Object> resultMap = new HashMap<>();

        try {
            String templatePid = (String) paramMap.get("template_pid");
            if (templatePid == null || templatePid.isEmpty()) {
                throw new BizException("ERR_TMPL_DEL_001", "템플릿 UUID가 누락되었습니다.");
            }

            int companyId = SessionUtil.getCurrentCompanyId();
            int userId    = SessionUtil.getCurrentUserId();

            HashMap<String, Object> findParam = new HashMap<>();
            findParam.put("pid", templatePid);
            findParam.put("company_id", companyId);
            findParam.put("user_id", userId);
            HashMap<String, Object> template = templateMapper.selectByPidAndUser(findParam);
            if (template == null) {
                throw new BizException("ERR_TMPL_DEL_002", "템플릿을 찾을 수 없습니다.");
            }

            HashMap<String, Object> deleteParam = new HashMap<>();
            deleteParam.put("id", template.get("id"));
            deleteParam.put("deleted_at", LocalDateTime.now());
            deleteParam.put("updated_at", LocalDateTime.now());
            templateMapper.softDeleteTemplate(deleteParam);

            logger.info("[템플릿삭제] 소프트삭제 완료 - template_pid: {}", templatePid);

            resultMap.put("result_code", "0000");
            resultMap.put("result_msg", "템플릿이 삭제되었습니다.");

        } catch (BizException e) {
            logger.warn("[템플릿삭제] 업무오류 - code: {}, msg: {}", e.getErrorCode(), e.getMessage());
            resultMap.put("result_code", e.getErrorCode());
            resultMap.put("result_msg", e.getMessage());
        } catch (Exception e) {
            logger.error("[템플릿삭제] 시스템오류 발생", e);
            resultMap.put("result_code", "ERR_SYS_001");
            resultMap.put("result_msg", "시스템 오류가 발생하였습니다.");
        }

        return resultMap;
    }
}
