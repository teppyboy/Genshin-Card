const pino = require("pino");
const NodeCache = require("node-cache");
const http = require("./utils/http");
const util = require("./utils/index");

const logger = pino({ level: process.env.LOG_LEVEL || "info" });

const roleIdCache = new NodeCache({ stdTTL: 60 * 60 * 24 * 365 });
const cardCache = new NodeCache({ stdTTL: 60 * 60 * 24 });

const __API = {
  FETCH_ROLE_ID:
    "https://bbs-api-os.hoyolab.com/game_record/app/card/wapi/getGameRecordCard",
  FETCH_ROLE_INDEX:
    "https://bbs-api-os.hoyolab.com/game_record/app/genshin/api/index",
};

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36",
  Origin: "https://act.hoyolab.com",
  Referer: "https://act.hoyolab.com/",
  Cookie: process.env.COOKIE,
  "x-rpc-app_version": "1.5.0",
  "x-rpc-client_type": 5, // web
  DS: "",
};

const MY_UID = process.env.MY_UID;
const COOKIE_PRIVATE = process.env.COOKIE_PRIVATE;

const getRoleInfo = (uid) => {
  const key = `__uid__${uid}`;

  return new Promise((resolve, reject) => {
    let cachedData = roleIdCache.get(key);
    if (cachedData) {
      const { game_role_id, nickname, region, region_name } = cachedData;
      logger.info(
        "从缓存中获取角色信息, uid %s, game_role_id %s, nickname %s, region %s, region_name %s",
        uid,
        game_role_id,
        nickname,
        region,
        region_name
      );
      resolve(cachedData);
    } else {
      const qs = { uid };

      http({
        method: "GET",
        url: __API.FETCH_ROLE_ID,
        qs,
        headers: {
          ...HEADERS,
          Cookie: uid === MY_UID ? COOKIE_PRIVATE : HEADERS.Cookie,
          DS: util.getDS(qs),
        },
      })
        .then((resp) => {
          resp = JSON.parse(resp);
          if (resp.retcode === 0) {
            if (resp.data.list && resp.data.list.length > 0) {
              const roleInfo = resp.data.list.find((_) => _.game_id === 2);

              if (!roleInfo) {
                logger.warn("无角色数据, uid %s", uid);
                reject(
                  "无角色数据，请检查输入的米哈游通行证ID是否有误（非游戏内的UID）和是否设置了公开角色信息，若操作无误则可能是被米哈游屏蔽，请第二天再试"
                );
              }

              const { game_role_id, nickname, region, region_name } = roleInfo;

              logger.info(
                "首次获取角色信息, uid %s, game_role_id %s, nickname %s, region %s, region_name %s",
                uid,
                game_role_id,
                nickname,
                region,
                region_name
              );

              roleIdCache.set(key, roleInfo);

              resolve(roleInfo);
            } else {
              logger.warn("无角色数据, uid %s", uid);
              reject(
                "无角色数据，请检查输入的米哈游通行证ID是否有误（非游戏内的UID）和是否设置了公开角色信息，若操作无误则可能是被米哈游屏蔽，请第二天再试"
              );
            }
          } else {
            logger.error("获取角色ID接口报错 %s", resp.message);
            reject(resp.message);
          }
        })
        .catch((err) => {
          logger.error("获取角色ID接口请求报错 %o", err);
        });
    }
  });
};

const userInfo = ({ uid, detail = false }) => {
  const key = `__uid__${uid}_${detail ? "detail" : "lite"}`;

  return new Promise((resolve, reject) => {
    let cachedBody = cardCache.get(key);
    if (cachedBody) {
      if (cachedBody.retcode === 10101) {
        reject(cachedBody.message);
      } else {
        resolve(cachedBody);
      }
      return;
    } else {
      getRoleInfo(uid)
        .then((roleInfo) => {
          const { game_role_id, region } = roleInfo;

          const qs = { role_id: game_role_id, server: region };

          if (detail) {
            http({
              method: "GET",
              url: __API.FETCH_ROLE_INDEX,
              qs,
              headers: {
                ...HEADERS,
                Cookie: uid === MY_UID ? COOKIE_PRIVATE : HEADERS.Cookie,
                DS: util.getDS(qs),
              },
            })
              .then((resp) => {
                resp = JSON.parse(resp);
                if (resp.retcode === 0) {
                  const { world_explorations } = resp.data;
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
                  );
                  const world_exploration = percentage;

                  const data = {
                    uid: game_role_id,
                    world_exploration,
                    ...resp.data.stats,
                    ...roleInfo,
                  };

                  cardCache.set(key, data);
                  resolve(data);
                } else {
                  cardCache.set(key, resp);
                  logger.error("获取角色详情接口报错 %s", resp.message);
                  reject(resp.message);
                }
              })
              .catch((err) => {
                logger.warn(err);
                reject(err);
              });
          } else {
            const [
              active_day_number,
              avatar_number,
              achievement_number,
              spiral_abyss,
            ] = roleInfo.data;

            const parsed = {
              active_day_number: active_day_number.value,
              avatar_number: avatar_number.value,
              achievement_number: achievement_number.value,
              spiral_abyss: spiral_abyss.value,
            };

            const data = {
              uid: game_role_id,
              ...parsed,
              ...roleInfo,
            };

            cardCache.set(key, data);
            resolve(data);
          }
        })
        .catch((err) => {
          logger.warn(err);
          reject(err);
        });
    }
  });
};

module.exports = userInfo;
