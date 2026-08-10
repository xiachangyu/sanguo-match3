const config = require('./config');
const storage = require('./storage');

// 流量主后台申请后填入 adUnitId
const AD_UNITS = {
  stamina: 'AD_UNIT_STAMINA_PLACEHOLDER',
  prop: 'AD_UNIT_PROP_PLACEHOLDER',
  revive: 'AD_UNIT_REVIVE_PLACEHOLDER',
};

const adCache = {}; // unitId -> { ad, resolve: null }

function getAd(unitId) {
  if (!wx.createRewardedVideoAd) return null;
  if (!adCache[unitId]) {
    const ad = wx.createRewardedVideoAd({ adUnitId: unitId });
    ad.onError(() => {
      // 加载失败：静默降级，UI 隐藏对应按钮
    });
    ad.onClose(res => {
      const entry = adCache[unitId];
      if (!entry) return;
      const resolve = entry.resolve;
      entry.resolve = null; // 单槽：一次只服务一个 watch
      if (resolve) resolve(res && res.isEnded === true);
    });
    adCache[unitId] = { ad, resolve: null };
  }
  return adCache[unitId];
}

// 播放广告，返回 Promise<boolean>：true=完整看完，false=中途退出或不可用
function watch(unitId) {
  const entry = getAd(unitId);
  if (!entry) return Promise.resolve(false);
  const ad = entry.ad;
  return new Promise(resolve => {
    entry.resolve = resolve;
    ad.show().catch(() => {
      ad.load().then(() => ad.show()).catch(() => {
        if (entry.resolve) {
          entry.resolve = null;
          resolve(false);
        }
      });
    });
  });
}

// 看广告补体力（每日限次）
function showStaminaAd() {
  const state = storage.load();
  if (state.daily.adsStamina >= config.AD_STAMINA_DAILY_LIMIT) return Promise.resolve({ ok: false, reason: 'limit' });
  return watch(AD_UNITS.stamina).then(done => {
    if (!done) return { ok: false, reason: 'cancelled' };
    state.daily.adsStamina += 1;
    state.stamina = Math.min(config.STAMINA_MAX, state.stamina + config.AD_STAMINA_AMOUNT);
    storage.save(state);
    return { ok: true, stamina: state.stamina };
  });
}

// 看广告得随机道具（每日限次）
function showPropAd() {
  const state = storage.load();
  if (state.daily.adsProp >= config.AD_PROP_DAILY_LIMIT) return Promise.resolve({ ok: false, reason: 'limit' });
  return watch(AD_UNITS.prop).then(done => {
    if (!done) return { ok: false, reason: 'cancelled' };
    state.daily.adsProp += 1;
    const prop = config.PROPS[Math.floor(Math.random() * config.PROPS.length)];
    state.props[prop] = (state.props[prop] || 0) + 1;
    storage.save(state);
    return { ok: true, prop };
  });
}

// 失败续命（每关限一次，由 main.js 的 reviveUsed 控制，此处只负责播放广告）
function showReviveAd() {
  return watch(AD_UNITS.revive).then(done => {
    if (!done) return { ok: false, reason: 'cancelled' };
    return { ok: true, seconds: config.AD_CONTINUE_SECONDS };
  });
}

// 分享得随机道具（每日首次）
function showShare() {
  const state = storage.load();
  if (state.daily.share >= 1) return { ok: false, reason: 'limit' };
  if (!wx.shareAppMessage) return { ok: false, reason: 'unsupported' };
  wx.shareAppMessage({ title: '来玩三国消消乐！', imageUrl: '' });
  state.daily.share += 1;
  const prop = config.PROPS[Math.floor(Math.random() * config.PROPS.length)];
  state.props[prop] = (state.props[prop] || 0) + 1;
  storage.save(state);
  return { ok: true, prop };
}

module.exports = { AD_UNITS, watch, showStaminaAd, showPropAd, showReviveAd, showShare };
