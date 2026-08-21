// 字块表示：
//   普通块 = 单字符字符串（如 '兵'）
//   特殊块 = { ch, special }，special ∈ 'row' | 'col' | 'bomb' | 'rainbow'
// 特殊块在移动/交换/下落时整体随引用移动，逻辑层统一用 chOf/specialOf 读取。

// 构造字块：无特殊类型时直接返回字符本身（保持旧结构兼容）
function tile(ch, special) {
  return special ? { ch, special } : ch;
}

// 取字块字符：字符串原样返回，对象返回 .ch
function chOf(t) {
  return typeof t === 'string' ? t : (t && t.ch) || null;
}

// 取字块特殊类型：无则 null
function specialOf(t) {
  return t && typeof t === 'object' ? t.special || null : null;
}

module.exports = { tile, chOf, specialOf };
