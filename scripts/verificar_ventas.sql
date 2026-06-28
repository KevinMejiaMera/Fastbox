-- ============================================================
-- FASTBOX - Script de Verificación de Ventas en Producción
-- Ejecutar en: docker exec -it fastbox_postgres_prod psql -U postgres -d fastbox_prod_db
-- ============================================================

-- 1. Resumen por día (últimos 60 días)
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
-- 2. Total del mes actual (Junio 2026)
SELECT 
    SUM(total_sales)   AS total_ventas_mes,
    SUM(total_orders)  AS total_ordenes_mes,
    SUM(COALESCE(cash_sales,0))  AS total_efectivo,
    SUM(COALESCE(card_sales,0))  AS total_tarjeta,
    SUM(COALESCE(other_sales,0)) AS total_otros
FROM pos_dailysummary
WHERE date >= '2026-06-01' AND date <= '2026-06-30';

-- ============================================================
-- 3. Verificar órdenes reales vs resumen (¿coinciden los totales?)
SELECT 
    DATE(o.created_at AT TIME ZONE 'America/Guayaquil') AS fecha,
    COUNT(*) AS ordenes_reales,
    ROUND(SUM(o.total_amount), 2) AS ventas_reales
FROM orders_order o
WHERE o.status IN ('delivered', 'completed')
  AND o.created_at >= NOW() - INTERVAL '60 days'
GROUP BY DATE(o.created_at AT TIME ZONE 'America/Guayaquil')
ORDER BY fecha DESC;

-- ============================================================
-- 4. Comparación: Resumen vs Órdenes Reales (ver si hay diferencia)
SELECT
    ds.date,
    ds.total_sales   AS ventas_en_resumen,
    ds.total_orders  AS ordenes_en_resumen,
    real.ventas_reales,
    real.ordenes_reales,
    ROUND(ds.total_sales - COALESCE(real.ventas_reales, 0), 2) AS diferencia
FROM pos_dailysummary ds
LEFT JOIN (
    SELECT 
        DATE(o.created_at AT TIME ZONE 'America/Guayaquil') AS fecha,
        COUNT(*) AS ordenes_reales,
        ROUND(SUM(o.total_amount), 2) AS ventas_reales
    FROM orders_order o
    WHERE o.status IN ('delivered', 'completed')
    GROUP BY DATE(o.created_at AT TIME ZONE 'America/Guayaquil')
) real ON real.fecha = ds.date
ORDER BY ds.date DESC
LIMIT 30;

-- ============================================================
-- 5. Métodos de pago reales (verificar efectivo vs transferencia)
SELECT
    DATE(o.created_at AT TIME ZONE 'America/Guayaquil') AS fecha,
    o.payment_method,
    COUNT(*) AS ordenes,
    ROUND(SUM(o.total_amount), 2) AS total
FROM orders_order o
WHERE o.status IN ('delivered', 'completed')
  AND o.created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(o.created_at AT TIME ZONE 'America/Guayaquil'), o.payment_method
ORDER BY fecha DESC, o.payment_method;
