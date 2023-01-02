const pino = require('pino')
const NodeCache = require('node-cache')
const http = require('./utils/http')
const util = require('./utils/index')

const logger = pino({ level: process.env.LOG_LEVEL || 'info' })

const roleIdCache = new NodeCache({ stdTTL: 60 * 60 * 24 * 365 })
const cardCache = new NodeCache({ stdTTL: 60 * 60 * 24 })

const __API = {
    FETCH_ROLE_ID:
        'https://bbs-api-os.hoyolab.com/game_record/card/wapi/getGameRecordCard',
    FETCH_ROLE_INDEX:
        'https://bbs-api-os.hoyolab.com/game_record/genshin/api/index',
}

const HEADERS = {
    Cookie: process.env.COOKIE,
}

// const MY_UID = process.env.MY_UID
// const COOKIE_PRIVATE = process.env.COOKIE_PRIVATE

async function getRoleInfo(uid) {
    const key = `__uid__${uid}`
    let cachedData = roleIdCache.get(key)
    if (cachedData) {
        logger.info(`Cached data: UID: ${uid}, ${cachedData}`)
        return cachedData
    }
    const params = { uid: uid }
    const rsp = (
        await http({
            method: 'GET',
            url: __API.FETCH_ROLE_ID,
            params: params,
            headers: {
                ...HEADERS,
                Cookie: HEADERS.Cookie,
            },
        })
    ).data
    if (rsp.retcode !== 0) {
        logger.error('获取角色ID接口报错')
        // logger.error(rsp.message)
        return
    }
    if (!rsp.data.list || rsp.data.list.length <= 0) {
        logger.warn('无角色数据, uid %s', uid)
        return
    }
    const roleInfo = rsp.data.list.find((_) => _.game_id === 2)

    if (!roleInfo) {
        logger.warn('无角色数据, uid %s', uid)
        reject(
            '无角色数据，请检查输入的米哈游通行证ID是否有误（非游戏内的UID）和是否设置了公开角色信息，若操作无误则可能是被米哈游屏蔽，请第二天再试'
        )
    }
    logger.info(`UID: ${uid}`)
    roleIdCache.set(key, roleInfo)
    return roleInfo
}

async function userInfo({ uid, detail = false }) {
    const key = `__uid__${uid}_${detail ? 'detail' : 'lite'}`
    let cachedBody = cardCache.get(key)
    if (cachedBody) {
        if (cachedBody.retcode === 10101) {
            return Promise.reject(cachedBody.message)
        } else {
            return cachedBody
        }
    }
    const roleInfo = await getRoleInfo(uid)
    const { game_role_id, region } = roleInfo
    logger.info(region)
    const params = { role_id: game_role_id, server: region }

    if (!detail) {
        const [
            active_day_number,
            avatar_number,
            achievement_number,
            spiral_abyss,
        ] = roleInfo.data

        const parsed = {
            active_day_number: active_day_number.value,
            avatar_number: avatar_number.value,
            achievement_number: achievement_number.value,
            spiral_abyss: spiral_abyss.value,
        }

        const data = {
            uid: game_role_id,
            ...parsed,
            ...roleInfo,
        }

        cardCache.set(key, data)
        return data
    }
    const resp = (
        await http({
            method: 'GET',
            url: __API.FETCH_ROLE_INDEX,
            params: params,
            headers: {
                ...HEADERS,
                Cookie: HEADERS.Cookie,
            },
        })
    ).data
    if (resp.retcode !== 0) {
        logger.error('获取角色详情接口报错 %s', resp.message)
        // logger.error(resp)
        return Promise.reject(resp.message)
    }
    const { world_explorations } = resp.data
    const percentage = Math.min(
        (
            (world_explorations.reduce(
                (total, next) => total + next.exploration_percentage,
                0
            ) /
                world_explorations.length /
                10000) *
            1000
        ).toFixed(1),
        100
    )
    const world_exploration = percentage

    const data = {
        uid: game_role_id,
        world_exploration,
        ...resp.data.stats,
        ...roleInfo,
    }
    cardCache.set(key, data)
    // logger.info(data)
    return data
}

module.exports = userInfo
