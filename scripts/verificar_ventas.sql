-- ============================================================
-- FASTBOX - Script de Verificación de Ventas en Producción
-- Ejecutar en: docker exec -it fastbox_postgres_prod psql -U postgres -d fastbox_db
-- ============================================================

-- 1. Resumen por día (últimos 60 días) con Ventas, Órdenes, Efectivo y Tarjeta
SELECT 
    date,
    total_sales,
    total_orders,
    COALESCE(cash_sales, 0)  AS efectivo,
    COALESCE(card_sales, 0)  AS tarjeta,
    COALESCE(other_sales, 0) AS otros,
    ROUND(COALESCE(cash_sales,0) + COALESCE(card_sales,0) + COALESCE(other_sales,0), 2) AS suma_metodos,
    is_closed
FROM pos_dailysummary
ORDER BY date DESC
LIMIT 60;

-- ============================================================
-- 2. Total del mes actual (Junio 2026) con Gastos y Ganancia Neta
WITH ventas_mes AS (
    SELECT 
        SUM(total_sales)   AS total_ventas_mes,
        SUM(total_orders)  AS total_ordenes_mes,
        SUM(COALESCE(cash_sales,0))  AS total_efectivo,
        SUM(COALESCE(card_sales,0))  AS total_tarjeta,
        SUM(COALESCE(other_sales,0)) AS total_otros
    FROM pos_dailysummary
    WHERE date >= '2026-06-01' AND date <= '2026-06-30'
),
gastos_mes AS (
    SELECT 
        SUM(amount) AS total_gastos_mes
    FROM payments_cashmovement
    WHERE movement_type = 'out' 
      AND reason = 'expense'
      AND created_at >= '2026-06-01' AND created_at <= '2026-06-30'
)
SELECT 
    v.total_ventas_mes,
    COALESCE(g.total_gastos_mes, 0) AS total_gastos_mes,
    (v.total_ventas_mes - COALESCE(g.total_gastos_mes, 0)) AS ganancia_neta,
    v.total_ordenes_mes,
    v.total_efectivo,
    v.total_tarjeta
FROM ventas_mes v, gastos_mes g;

-- ============================================================
-- 3. Detalle de Gastos del Mes (Junio 2026)
SELECT 
    created_at::date AS fecha,
    amount AS monto,
    description AS descripcion,
    performed_by AS realizado_por
FROM payments_cashmovement
WHERE movement_type = 'out' 
  AND reason = 'expense'
  AND created_at >= '2026-06-01' AND created_at <= '2026-06-30'
ORDER BY created_at DESC;

-- ============================================================
-- 4. Verificar órdenes reales vs resumen (¿coinciden los totales?)
SELECT 
    DATE(o.created_at AT TIME ZONE 'America/Guayaquil') AS fecha,
    COUNT(*) AS ordenes_reales,
    ROUND(SUM(o.total_amount), 2) AS ventas_reales
FROM orders_order o
WHERE o.status IN ('delivered', 'completed')
  AND o.created_at >= NOW() - INTERVAL '60 days'
GROUP BY DATE(o.created_at AT TIME ZONE 'America/Guayaquil')
ORDER BY fecha DESC;
