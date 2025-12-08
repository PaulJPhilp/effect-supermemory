/**
 * @since 1.0.0
 * @module FilterBuilder
 *
 * Fluent, functional API for building type-safe search filters.
 * Filters compose via functional combinators (and, or, not) and
 * compile to the JSON format expected by Supermemory API.
 */

import {
  API_FIELD_NAMES,
  FILTER_JSON_OPERATORS,
  FILTER_OPERATORS,
  FILTER_TAGS,
} from "@/Constants.js";

/**
 * Comparison operators for metadata field filtering.
 *
 * - `eq`: Equal to
 * - `ne`: Not equal to
 * - `lt`: Less than
 * - `lte`: Less than or equal to
 * - `gt`: Greater than
 * - `gte`: Greater than or equal to
 * - `in`: Value is in array
 *
 * @since 1.0.0
 * @category Types
 */
export type FilterOperator = "eq" | "ne" | "lt" | "lte" | "gt" | "gte" | "in";

/**
 * Primitive value types supported in filter comparisons.
 *
 * @since 1.0.0
 * @category Types
 */
export type FilterPrimitive = string | number | boolean;

/**
 * Value types accepted by metadata filters.
 *
 * Can be a single primitive or an array of primitives (for `in` operator).
 *
 * @since 1.0.0
 * @category Types
 */
export type FilterValue = FilterPrimitive | FilterPrimitive[];

/**
 * Represents a single filter condition.
 *
 * @since 1.0.0
 * @category Types
 */
export type FilterExpression =
  | TagFilter
  | MetadataFilter
  | ScoreFilter
  | AndFilter
  | OrFilter
  | NotFilter;

/**
 * Filter by tag presence.
 *
 * @since 1.0.0
 * @category Types
 */
export type TagFilter = {
  readonly _tag: typeof FILTER_TAGS.TAG_FILTER;
  readonly value: string;
};

/**
 * Filter by metadata field value.
 *
 * @since 1.0.0
 * @category Types
 */
export type MetadataFilter = {
  readonly _tag: typeof FILTER_TAGS.METADATA_FILTER;
  readonly field: string;
  readonly operator: FilterOperator;
  readonly value: FilterValue;
};

/**
 * Filter by relevance score range.
 *
 * @since 1.0.0
 * @category Types
 */
export type ScoreFilter = {
  readonly _tag: typeof FILTER_TAGS.SCORE_FILTER;
  readonly min: number | undefined;
  readonly max: number | undefined;
};

/**
 * Logical AND of multiple filters.
 *
 * @since 1.0.0
 * @category Types
 */
export type AndFilter = {
  readonly _tag: typeof FILTER_TAGS.AND_FILTER;
  readonly conditions: readonly FilterExpression[];
};

/**
 * Logical OR of multiple filters.
 *
 * @since 1.0.0
 * @category Types
 */
export type OrFilter = {
  readonly _tag: typeof FILTER_TAGS.OR_FILTER;
  readonly conditions: readonly FilterExpression[];
};

/**
 * Logical NOT of a filter.
 *
 * @since 1.0.0
 * @category Types
 */
export type NotFilter = {
  readonly _tag: typeof FILTER_TAGS.NOT_FILTER;
  readonly condition: FilterExpression;
};

/**
 * Serialize a filter expression to JSON format for API.
 *
 * @since 1.0.0
 * @category Serialization
 */
export const toJSON = (filter: FilterExpression): Record<string, unknown> => {
  switch (filter._tag) {
    case FILTER_TAGS.TAG_FILTER:
      return { [API_FIELD_NAMES.TAG]: filter.value };

    case FILTER_TAGS.METADATA_FILTER: {
      const key = `${API_FIELD_NAMES.METADATA_PREFIX}${filter.field}`;
      switch (filter.operator) {
        case FILTER_OPERATORS.EQUAL:
          return { [key]: filter.value };
        case FILTER_OPERATORS.NOT_EQUAL:
          return { [key]: { [FILTER_JSON_OPERATORS.NOT_EQUAL]: filter.value } };
        case FILTER_OPERATORS.LESS_THAN:
          return { [key]: { [FILTER_JSON_OPERATORS.LESS_THAN]: filter.value } };
        case FILTER_OPERATORS.LESS_THAN_OR_EQUAL:
          return {
            [key]: { [FILTER_JSON_OPERATORS.LESS_THAN_OR_EQUAL]: filter.value },
          };
        case FILTER_OPERATORS.GREATER_THAN:
          return {
            [key]: { [FILTER_JSON_OPERATORS.GREATER_THAN]: filter.value },
          };
        case FILTER_OPERATORS.GREATER_THAN_OR_EQUAL:
          return {
            [key]: {
              [FILTER_JSON_OPERATORS.GREATER_THAN_OR_EQUAL]: filter.value,
            },
          };
        case FILTER_OPERATORS.IN:
          return { [key]: { [FILTER_JSON_OPERATORS.IN]: filter.value } };
        default: {
          const _exhaustive: never = filter.operator;
          return _exhaustive;
        }
      }
    }

    case FILTER_TAGS.SCORE_FILTER: {
      const conditions: Record<string, unknown>[] = [];
      if (filter.min !== undefined) {
        conditions.push({
          [API_FIELD_NAMES.SCORE]: {
            [FILTER_JSON_OPERATORS.GREATER_THAN_OR_EQUAL]: filter.min,
          },
        });
      }
      if (filter.max !== undefined) {
        conditions.push({
          [API_FIELD_NAMES.SCORE]: {
            [FILTER_JSON_OPERATORS.LESS_THAN_OR_EQUAL]: filter.max,
          },
        });
      }
      if (conditions.length === 0) {
        return {};
      }
      if (conditions.length === 1) {
        const firstCondition = conditions[0];
        if (firstCondition === undefined) {
          return {};
        }
        return firstCondition;
      }
      return { [FILTER_JSON_OPERATORS.AND]: conditions };
    }

    case FILTER_TAGS.AND_FILTER:
      return {
        [FILTER_JSON_OPERATORS.AND]: filter.conditions.map(toJSON),
      };

    case FILTER_TAGS.OR_FILTER:
      return {
        [FILTER_JSON_OPERATORS.OR]: filter.conditions.map(toJSON),
      };

    case FILTER_TAGS.NOT_FILTER:
      return {
        [FILTER_JSON_OPERATORS.NOT]: toJSON(filter.condition),
      };

    default: {
      const _exhaustive: never = filter;
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
  tag: (value: string): TagFilter => ({
    _tag: FILTER_TAGS.TAG_FILTER,
    value,
  }),

  /**
   * Filter by metadata field equality.
   * @example
   * Filter.meta("author", "eq", "Paul")
   */
  meta: (
    field: string,
    operator: FilterOperator,
    value: FilterValue
  ): MetadataFilter => ({
    _tag: FILTER_TAGS.METADATA_FILTER,
    field,
    operator,
    value,
  }),

  /**
   * Filter by relevance score range.
   * @example
   * Filter.scoreRange(0.5, 1.0)
   */
  scoreRange: (min?: number, max?: number): ScoreFilter => ({
    _tag: FILTER_TAGS.SCORE_FILTER,
    min,
    max,
  }),

  /**
   * Logical AND of multiple filters.
   * @example
   * Filter.and(Filter.tag("archived"), Filter.meta("version", "gt", 2))
   */
  and: (...conditions: FilterExpression[]): AndFilter => ({
    _tag: FILTER_TAGS.AND_FILTER,
    conditions,
  }),

  /**
   * Logical OR of multiple filters.
   * @example
   * Filter.or(Filter.tag("draft"), Filter.tag("archived"))
   */
  or: (...conditions: FilterExpression[]): OrFilter => ({
    _tag: FILTER_TAGS.OR_FILTER,
    conditions,
  }),

  /**
   * Logical NOT of a filter.
   * @example
   * Filter.not(Filter.tag("archived"))
   */
  not: (condition: FilterExpression): NotFilter => ({
    _tag: FILTER_TAGS.NOT_FILTER,
    condition,
  }),
} as const;
