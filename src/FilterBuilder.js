/**
 * @since 1.0.0
 * @module FilterBuilder
 *
 * Fluent, functional API for building type-safe search filters.
 * Filters compose via functional combinators (and, or, not) and
 * compile to the JSON format expected by Supermemory API.
 */
/**
 * Serialize a filter expression to JSON format for API.
 *
 * @since 1.0.0
 * @category Serialization
 */
export const toJSON = (filter) => {
  switch (filter._tag) {
    case "TagFilter":
      return { tag: filter.value };
    case "MetadataFilter": {
      const key = `metadata.${filter.field}`;
      switch (filter.operator) {
        case "eq":
          return { [key]: filter.value };
        case "ne":
          return { [key]: { $ne: filter.value } };
        case "lt":
          return { [key]: { $lt: filter.value } };
        case "lte":
          return { [key]: { $lte: filter.value } };
        case "gt":
          return { [key]: { $gt: filter.value } };
        case "gte":
          return { [key]: { $gte: filter.value } };
        case "in":
          return { [key]: { $in: filter.value } };
        default: {
          const _exhaustive = filter.operator;
          return _exhaustive;
        }
      }
    }
    case "ScoreFilter": {
      const conditions = [];
      if (filter.min !== undefined) {
        conditions.push({ score: { $gte: filter.min } });
      }
      if (filter.max !== undefined) {
        conditions.push({ score: { $lte: filter.max } });
      }
      if (conditions.length === 0) {
        return {};
      }
      if (conditions.length === 1) {
        return conditions[0];
      }
      return { $and: conditions };
    }
    case "AndFilter":
      return {
        $and: filter.conditions.map(toJSON),
      };
    case "OrFilter":
      return {
        $or: filter.conditions.map(toJSON),
      };
    case "NotFilter":
      return {
        $not: toJSON(filter.condition),
      };
    default: {
      const _exhaustive = filter;
      return _exhaustive;
    }
  }
};
/**
 * Filter builder API.
 *
 * @since 1.0.0
 * @category API
 */
export const Filter = {
  /**
   * Filter by tag.
   * @example
   * Filter.tag("archived")
   */
  tag: (value) => ({
    _tag: "TagFilter",
    value,
  }),
  /**
   * Filter by metadata field equality.
   * @example
   * Filter.meta("author", "eq", "Paul")
   */
  meta: (field, operator, value) => ({
    _tag: "MetadataFilter",
    field,
    operator,
    value,
  }),
  /**
   * Filter by relevance score range.
   * @example
   * Filter.scoreRange(0.5, 1.0)
   */
  scoreRange: (min, max) => ({
    _tag: "ScoreFilter",
    min,
    max,
  }),
  /**
   * Logical AND of multiple filters.
   * @example
   * Filter.and(Filter.tag("archived"), Filter.meta("version", "gt", 2))
   */
  and: (...conditions) => ({
    _tag: "AndFilter",
    conditions,
  }),
  /**
   * Logical OR of multiple filters.
   * @example
   * Filter.or(Filter.tag("draft"), Filter.tag("archived"))
   */
  or: (...conditions) => ({
    _tag: "OrFilter",
    conditions,
  }),
  /**
   * Logical NOT of a filter.
   * @example
   * Filter.not(Filter.tag("archived"))
   */
  not: (condition) => ({
    _tag: "NotFilter",
    condition,
  }),
};
