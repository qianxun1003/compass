/**
 * 操作日志写入（管理后台 + 学生端共用）
 * 记录：操作人、时间、动作、对象、IP、结果、详情（含年月日时间、描述等）
 */
function writeOperationLog(pool, operatorId, operatorName, action, targetType, targetId, ip, result, details) {
  pool.query(
    'INSERT INTO operation_logs (operator_id, operator_name, action, target_type, target_id, ip, result, details) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
    [
      operatorId,
      operatorName,
      action,
      targetType || null,
      targetId || null,
      ip || null,
      result || 'success',
      details ? JSON.stringify(details) : null
    ]
  ).catch((err) => console.error('operation_log write error:', err));
}

module.exports = { writeOperationLog };
