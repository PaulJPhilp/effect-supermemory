/**
 * @since 1.0.0
 * @module FilterBuilder
 *
 * Fluent, functional API for building type-safe search filters.
 * Filters compose via functional combinators (and, or, not) and
 * compile to the JSON format expected by Supermemory API.
 */

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
export interface TagFilter {
	readonly _tag: "TagFilter";
	readonly value: string;
}

/**
 * Filter by metadata field value.
 *
 * @since 1.0.0
 * @category Types
 */
export interface MetadataFilter {
	readonly _tag: "MetadataFilter";
	readonly field: string;
	readonly operator: "eq" | "ne" | "lt" | "lte" | "gt" | "gte" | "in";
	readonly value: string | number | boolean | (string | number | boolean)[];
}

/**
 * Filter by relevance score range.
 *
 * @since 1.0.0
 * @category Types
 */
export interface ScoreFilter {
	readonly _tag: "ScoreFilter";
	readonly min: number | undefined;
	readonly max: number | undefined;
}

/**
 * Logical AND of multiple filters.
 *
 * @since 1.0.0
 * @category Types
 */
export interface AndFilter {
	readonly _tag: "AndFilter";
	readonly conditions: readonly FilterExpression[];
}

/**
 * Logical OR of multiple filters.
 *
 * @since 1.0.0
 * @category Types
 */
export interface OrFilter {
	readonly _tag: "OrFilter";
	readonly conditions: readonly FilterExpression[];
}

/**
 * Logical NOT of a filter.
 *
 * @since 1.0.0
 * @category Types
 */
export interface NotFilter {
	readonly _tag: "NotFilter";
	readonly condition: FilterExpression;
}

/**
 * Serialize a filter expression to JSON format for API.
 *
 * @since 1.0.0
 * @category Serialization
 */
export const toJSON = (filter: FilterExpression): Record<string, unknown> => {
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
				default:
					const _exhaustive: never = filter.operator;
					return _exhaustive;
			}
		}

		case "ScoreFilter": {
			const conditions: Record<string, unknown>[] = [];
			if (filter.min !== undefined) {
				conditions.push({ score: { $gte: filter.min } });
			}
			if (filter.max !== undefined) {
				conditions.push({ score: { $lte: filter.max } });
			}
			if (conditions.length === 0) return {};
			if (conditions.length === 1) return conditions[0]!;
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

		default:
			const _exhaustive: never = filter;
			return _exhaustive;
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
		_tag: "TagFilter",
		value,
	}),

	/**
	 * Filter by metadata field equality.
	 * @example
	 * Filter.meta("author", "eq", "Paul")
	 */
	meta: (
		field: string,
		operator: "eq" | "ne" | "lt" | "lte" | "gt" | "gte" | "in",
		value: string | number | boolean | (string | number | boolean)[]
	): MetadataFilter => ({
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
	scoreRange: (min?: number, max?: number): ScoreFilter => ({
		_tag: "ScoreFilter",
		min,
		max,
	}),

	/**
	 * Logical AND of multiple filters.
	 * @example
	 * Filter.and(Filter.tag("archived"), Filter.meta("version", "gt", 2))
	 */
	and: (...conditions: FilterExpression[]): AndFilter => ({
		_tag: "AndFilter",
		conditions,
	}),

	/**
	 * Logical OR of multiple filters.
	 * @example
	 * Filter.or(Filter.tag("draft"), Filter.tag("archived"))
	 */
	or: (...conditions: FilterExpression[]): OrFilter => ({
		_tag: "OrFilter",
		conditions,
	}),

	/**
	 * Logical NOT of a filter.
	 * @example
	 * Filter.not(Filter.tag("archived"))
	 */
	not: (condition: FilterExpression): NotFilter => ({
		_tag: "NotFilter",
		condition,
	}),
} as const;
