/* Динамические заголовки слайдов.
 * Чистые функции без DOM: одна точка входа на раздел, правила по разделам.
 * Загружается из index.html и подключается в тестах через require (см. tests/headline.test.js).
 */
(function(root){
  'use strict';

  var MIN_HEADCOUNT_SHARE = 0.005; // 0,5% штата
  var MIN_RATE_PP = 0.5;           // 0,5 п.п.
  var MAX_HEADLINE_LENGTH = 70;

  var ORDINALS = ['первый','второй','третий','четвёртый','пятый','шестой','седьмой','восьмой','девятый','десятый'];

  // Дательный падеж месяцев для подписи «к сентябрю».
  var MONTH_DATIVE = {
    'январь':'январю','февраль':'февралю','март':'марту','апрель':'апрелю','май':'маю','июнь':'июню',
    'июль':'июлю','август':'августу','сентябрь':'сентябрю','октябрь':'октябрю','ноябрь':'ноябрю','декабрь':'декабрю'
  };

  function plural(n, one, few, many){
    var a = Math.abs(n) % 100;
    var b = a % 10;
    if(a > 10 && a < 20) return many;
    if(b === 1) return one;
    if(b >= 2 && b <= 4) return few;
    return many;
  }
  function peopleWord(n){ return plural(n, 'человека', 'человека', 'человек'); }
  function fmtRate(v){ return v.toFixed(1).replace('.', ','); }
  function fmtInt(v){ return String(Math.round(v)); }
  function capitalize(s){ return s.charAt(0).toUpperCase() + s.slice(1); }

  function lastTwo(arr){
    if(!arr || arr.length < 2) return null;
    return [arr[arr.length-2].count, arr[arr.length-1].count];
  }

  /* ---- Состав компании ---- */

  // Изменения к прошлому месяцу. Метрика либо попадает в результат, либо null (нет данных).
  function compositionChanges(d){
    var out = {};
    var hc = lastTwo(d.headcountHistory);
    if(hc){
      var delta = hc[1] - hc[0];
      out.headcount = { delta: delta, share: Math.abs(delta) / hc[0], current: hc[1] };
    }
    if(d.turnoverRate && d.turnoverRate.prev != null){
      var t = d.turnoverRate.current - d.turnoverRate.prev;
      out.turnover = { delta: t, current: d.turnoverRate.current };
    }
    if(d.internalFillRate && d.internalFillRate.prev != null){
      var f = d.internalFillRate.current - d.internalFillRate.prev;
      out.fill = { delta: f, current: d.internalFillRate.current };
    }
    return out;
  }

  // Порядок выбора, когда значимых изменений больше двух: численность, текучесть, внутреннее закрытие.
  // По отношению Δ к порогу внутреннее закрытие почти всегда оказывается «самым значимым»,
  // поэтому сравнивать по величине не годится: заголовок описывает штат и текучесть.
  var COMPOSITION_PRIORITY = ['headcount', 'turnover', 'fill'];

  function compositionParts(changes){
    var parts = [];
    COMPOSITION_PRIORITY.forEach(function(key){
      var c = changes[key];
      if(!c) return;
      if(key === 'headcount' && Math.abs(c.share) >= MIN_HEADCOUNT_SHARE){
        var n = Math.abs(c.delta);
        parts.push(c.delta < 0
          ? 'штат сократился на ' + n + ' ' + peopleWord(n)
          : 'штат вырос на ' + n + ' ' + peopleWord(n));
      }
      if(key === 'turnover' && Math.abs(c.delta) >= MIN_RATE_PP){
        parts.push('текучесть ' + (c.delta < 0 ? 'снизилась' : 'выросла') + ' до ' + fmtRate(c.current) + '%');
      }
      if(key === 'fill' && Math.abs(c.delta) >= MIN_RATE_PP){
        parts.push('внутреннее закрытие ' + (c.delta < 0 ? 'снизилось' : 'выросло') + ' до ' + fmtInt(c.current) + '%');
      }
    });
    return parts;
  }

  function compositionHeadline(d){
    var changes = compositionChanges(d);
    if(!changes.headcount && !changes.turnover && !changes.fill) return 'Состав компании';
    var parts = compositionParts(changes);
    if(!parts.length) return 'Состав компании без существенных изменений';
    var text = parts.slice(0, 2).join(', ');
    if(text.length > MAX_HEADLINE_LENGTH) text = parts[0];
    return capitalize(text);
  }

  /* ---- Карточки состава ---- */

  function structureCardTitle(d){
    var list = d.structureByDept || [];
    if(!list.length) return 'Структура по подразделениям';
    var top = list.reduce(function(a, b){ return b.count > a.count ? b : a; });
    var total = d.headcountHistory && d.headcountHistory.length
      ? d.headcountHistory[d.headcountHistory.length-1].count
      : list.reduce(function(s, x){ return s + x.count; }, 0);
    var share = top.count / total;
    if(share >= 0.45) return 'Половина штата — ' + top.dept;
    if(share >= 0.30) return top.dept + ' — ' + Math.round(share * 100) + '% штата';
    return 'Структура по подразделениям';
  }

  // Сколько подряд месяцев рост к последнему месяцу: 2 роста подряд = растёт второй месяц.
  function risingStreak(history){
    var streak = 0;
    for(var i = history.length - 1; i > 0; i--){
      if(history[i].rate > history[i-1].rate) streak++;
      else break;
    }
    return streak;
  }

  function turnoverCardTitle(d){
    var best = null;
    (d.departmentTurnover || []).forEach(function(dt){
      var s = risingStreak(dt.history || []);
      if(s >= 2 && (!best || s > best.streak)) best = { dept: dt.dept, streak: s };
    });
    if(!best) return 'Текучесть по подразделениям';
    var word = ORDINALS[best.streak - 1] || (best.streak + '-й');
    return 'Текучесть в ' + best.dept + ' растёт ' + word + ' месяц подряд';
  }

  /* ---- Реестр разделов ---- */

  var RULES = {
    composition: {
      section: 'Состав компании',
      headline: compositionHeadline,
      hasPrevious: function(d){
        var c = compositionChanges(d);
        return !!(c.headcount || c.turnover || c.fill);
      },
      cards: {
        structure: structureCardTitle,
        turnover: turnoverCardTitle
      }
    }
  };

  // Заголовок слайда. Без данных за прошлый месяц возвращается название раздела.
  function buildHeadline(section, data){
    var rule = RULES[section];
    if(!rule || !data) return rule ? rule.section : '';
    if(!rule.hasPrevious(data)) return rule.section;
    return rule.headline(data);
  }

  // Заголовок карточки раздела; пустой ключ даёт null, чтобы вызывающий код использовал свой текст.
  function buildCardTitle(section, cardKey, data){
    var rule = RULES[section];
    if(!rule || !rule.cards || !rule.cards[cardKey] || !data) return null;
    return rule.cards[cardKey](data);
  }

  // Подпись «Октябрь 2026 · к сентябрю»: текущий и предыдущий период из meta.
  function periodCompareLabel(meta){
    if(!meta || !meta.period) return '';
    var prev = meta.prevPeriod || '';
    var prevMonth = prev.split(' ')[0].toLowerCase();
    var dative = MONTH_DATIVE[prevMonth];
    return meta.period + (dative ? ' · к ' + dative : '');
  }

  var api = {
    buildHeadline: buildHeadline,
    buildCardTitle: buildCardTitle,
    periodCompareLabel: periodCompareLabel,
    _internal: { plural: plural, risingStreak: risingStreak, compositionChanges: compositionChanges }
  };

  if(typeof module !== 'undefined' && module.exports){ module.exports = api; }
  else { root.HRHeadline = api; }
})(typeof window !== 'undefined' ? window : globalThis);
