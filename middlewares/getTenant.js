module.exports = function getTenant(req, res, next) {
    // Intentar obtener el tenant desde x-tenant o desde origin
    const tenantSource = req.headers['x-tenant'];

    if (!tenantSource) {
        return res.status(400).json({ error: 'Tenant o Host no definido' });
    }

    let host;

    // Si contiene la estructura de URL (// y .)
    if (tenantSource.includes('//')) {
        host = tenantSource.split('//')[1].split('.')[0];
    } else {
        // Si es solo el nombre directo (evita errores si no hay puntos)
        host = tenantSource.split('.')[0];
    }

    if (!host) {
        return res.status(400).json({ error: 'No se pudo determinar el tenant' });
    }

    req.tenant = host;
    next();
};
