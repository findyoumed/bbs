/**
 * [LOG: 20260502_0510] BBS 가상 네트워크 서비스 및 프로토콜 시뮬레이터 구축
 */

const VIRTUAL_HOSTS = {
    'localhost': { ip: '127.0.0.1', services: ['SSH', 'HTTP', 'BBS'], status: 'ALIVE' },
    'bbs.central': { ip: '10.0.0.1', services: ['BBS', 'TELNET'], status: 'ALIVE' },
    'news.gateway': { ip: '10.0.0.5', services: ['RSS', 'HTTP'], status: 'ALIVE' },
    'weather.station': { ip: '10.0.0.8', services: ['DATA', 'UDP'], status: 'ALIVE' },
    'mail.core': { ip: '10.0.0.10', services: ['SMTP', 'POP3'], status: 'ALIVE' },
    'backup.server': { ip: '192.168.1.50', services: ['RSYNC'], status: 'SLEEPING' },
};

export const createNetworkService = () => {
    let connections = [];
    let latencyBase = 15;

    const ping = async (host) => {
        const target = VIRTUAL_HOSTS[host] || Object.values(VIRTUAL_HOSTS).find(h => h.ip === host);
        if (!target) return { success: false, message: `Unknown host: ${host}` };
        
        const latency = latencyBase + Math.floor(Math.random() * 20);
        await new Promise(r => setTimeout(r, latency));
        
        if (target.status === 'ALIVE') {
            return { success: true, ip: target.ip, latency };
        } else {
            return { success: false, message: 'Request timeout' };
        }
    };

    const finger = (host) => {
        const target = VIRTUAL_HOSTS[host] || Object.values(VIRTUAL_HOSTS).find(h => h.ip === host);
        if (!target) return null;
        return {
            name: host,
            ip: target.ip,
            services: target.services,
            status: target.status,
            uptime: '99.9%'
        };
    };

    const getNetstat = () => {
        return Object.entries(VIRTUAL_HOSTS).map(([name, data]) => ({
            name,
            ip: data.ip,
            status: data.status
        }));
    };

    return {
        ping,
        finger,
        getNetstat
    };
};
