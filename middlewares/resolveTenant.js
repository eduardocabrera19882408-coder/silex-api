const pool = require('../config/dbMaster');

const tenantCache = new Map();
const pending = new Map();

async function getTenantData(subdomain) {
    if (tenantCache.has(subdomain)) {
        return tenantCache.get(subdomain);
    }

    if (pending.has(subdomain)) {
        return pending.get(subdomain);
    }
    console.log('subdomain: ' + subdomain);
    const promise = pool.query('SELECT schema_name FROM tenant WHERE subdomain = $1', [subdomain])
        .then(result => {
            if (result.rows.length === 0) {
                throw new Error('Tenant no encontrado');
            }

            const tenant = result.rows[0];

            tenantCache.set(subdomain, tenant);
            pending.delete(subdomain);

            return tenant;
        }).catch(err => {
            console.log('Error al obtener el tenant: ' + err);
            pending.delete(subdomain);
            throw err;
        });

    pending.set(subdomain, promise);

    console.log(promise)

    return promise;
}

module.exports = async function resolveTenant(req, res, next) {
    try {
        console.log('resolveTenant', req.tenant);
        const tenantData = await getTenantData(req.tenant);

        req.schema = tenantData.schema_name;
        console.log(tenantData.schema_name);

        next();
    } catch (err) {
        return res.status(404).json({ error: 'Tenant no válido' });
    }
};