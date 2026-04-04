// F0967: API sorting - parse sort params and apply to queries
// F0968: API filtering - parse filter params and apply to queries

import { SupabaseClient } from '@supabase/supabase-js'

/**
 * F0967: Sort direction
 */
export type SortDirection = 'asc' | 'desc'

/**
 * F0967: Parse sort parameters from URL search params
 *
 * Supports:
 * - ?sort=created_at (defaults to asc)
 * - ?sort=created_at:desc
 * - ?sort=-created_at (desc using - prefix)
 * - ?sortBy=created_at&sortDirection=desc
 *
 * @example
 * parseSortParams(searchParams) // { column: 'created_at', direction: 'asc' }
 */
export function parseSortParams(searchParams: URLSearchParams): {
  column: string
  direction: SortDirection
} | null {
  // Method 1: ?sort=column or ?sort=column:direction or ?sort=-column
  const sort = searchParams.get('sort')
  if (sort) {
    if (sort.startsWith('-')) {
      return { column: sort.slice(1), direction: 'desc' }
    }
    const [column, direction] = sort.split(':')
    return {
      column,
      direction: (direction === 'desc' ? 'desc' : 'asc') as SortDirection,
    }
  }

  // Method 2: ?sortBy=column&sortDirection=desc
  const sortBy = searchParams.get('sortBy')
  const sortDirection = searchParams.get('sortDirection')
  if (sortBy) {
    return {
      column: sortBy,
      direction: (sortDirection === 'desc' ? 'desc' : 'asc') as SortDirection,
    }
  }

  return null
}

/**
 * F0968: Supported filter operators
 */
export type FilterOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'ilike' | 'in' | 'is'

/**
 * F0968: Filter condition
 */
export interface FilterCondition {
  column: string
  operator: FilterOperator
  value: any
}

/**
 * F0968: Parse filter parameters from URL search params
 *
 * Supports:
 * - ?filter[status]=completed
 * - ?filter[status][eq]=completed
 * - ?filter[duration][gte]=60
 * - ?filter[sentiment][in]=positive,neutral
 * - ?status=completed (shorthand)
 *
 * Reserved params (ignored): page, limit, offset, sort, sortBy, sortDirection
 *
 * @example
 * parseFilterParams(searchParams)
 * // [{ column: 'status', operator: 'eq', value: 'completed' }]
 */
export function parseFilterParams(searchParams: URLSearchParams): FilterCondition[] {
  const filters: FilterCondition[] = []
  const reservedParams = ['page', 'limit', 'offset', 'sort', 'sortBy', 'sortDirection']

  for (const [key, value] of Array.from(searchParams.entries())) {
    if (reservedParams.includes(key)) continue

    // Method 1: ?filter[column][operator]=value
    const filterMatch = key.match(/^filter\[([^\]]+)\](?:\[([^\]]+)\])?$/)
    if (filterMatch) {
      const column = filterMatch[1]
      const operator = (filterMatch[2] || 'eq') as FilterOperator

      // Handle 'in' operator with comma-separated values
      const filterValue = operator === 'in' ? value.split(',') : value

      filters.push({ column, operator, value: filterValue })
      continue
    }

    // Method 2: ?column=value (shorthand for eq)
    if (!key.startsWith('filter')) {
      filters.push({ column: key, operator: 'eq', value })
    }
  }

  return filters
}

/**
 * F0968: Apply filter to Supabase query
 */
export function applyFilter<T>(
  query: any,
  filter: FilterCondition
): any {
  const { column, operator, value } = filter

  switch (operator) {
    case 'eq':
      return query.eq(column, value)
    case 'neq':
      return query.neq(column, value)
    case 'gt':
      return query.gt(column, value)
    case 'gte':
      return query.gte(column, value)
    case 'lt':
      return query.lt(column, value)
    case 'lte':
      return query.lte(column, value)
    case 'like':
      return query.like(column, value)
    case 'ilike':
      return query.ilike(column, value)
    case 'in':
      return query.in(column, Array.isArray(value) ? value : [value])
    case 'is':
      return query.is(column, value)
    default:
      return query
  }
}

/**
 * F0967 + F0968: Build Supabase query with sorting and filtering
 *
 * @example
 * const query = buildSupabaseQuery(
 *   supabase.from('calls'),
 *   searchParams,
 *   { defaultSort: { column: 'created_at', direction: 'desc' } }
 * )
 * const { data } = await query
 */
export function buildSupabaseQuery(
  baseQuery: any,
  searchParams: URLSearchParams,
  options?: {
    defaultSort?: { column: string; direction: SortDirection }
    allowedSortColumns?: string[]
    allowedFilterColumns?: string[]
  }
): any {
  let query = baseQuery

  // Apply filters (F0968)
  const filters = parseFilterParams(searchParams)
  for (const filter of filters) {
    // Validate allowed columns if specified
    if (options?.allowedFilterColumns && !options.allowedFilterColumns.includes(filter.column)) {
      continue // Skip invalid columns
    }
    query = applyFilter(query, filter)
  }

  // Apply sorting (F0967)
  const sort = parseSortParams(searchParams)
  const sortConfig = sort || options?.defaultSort

  if (sortConfig) {
    // Validate allowed columns if specified
    if (!options?.allowedSortColumns || options.allowedSortColumns.includes(sortConfig.column)) {
      query = query.order(sortConfig.column, { ascending: sortConfig.direction === 'asc' })
    }
  }

  return query
}

/**
 * F0968: Build WHERE clause for raw SQL queries
 *
 * @example
 * const { clause, params } = buildWhereClause(filters)
 * // { clause: 'status = $1 AND duration >= $2', params: ['completed', 60] }
 */
export function buildWhereClause(filters: FilterCondition[]): {
  clause: string
  params: any[]
} {
  if (filters.length === 0) {
    return { clause: '', params: [] }
  }

  const conditions: string[] = []
  const params: any[] = []

  filters.forEach((filter, index) => {
    const paramIndex = index + 1
    const { column, operator, value } = filter

    switch (operator) {
      case 'eq':
        conditions.push(`${column} = $${paramIndex}`)
        params.push(value)
        break
      case 'neq':
        conditions.push(`${column} != $${paramIndex}`)
        params.push(value)
        break
      case 'gt':
        conditions.push(`${column} > $${paramIndex}`)
        params.push(value)
        break
      case 'gte':
        conditions.push(`${column} >= $${paramIndex}`)
        params.push(value)
        break
      case 'lt':
        conditions.push(`${column} < $${paramIndex}`)
        params.push(value)
        break
      case 'lte':
        conditions.push(`${column} <= $${paramIndex}`)
        params.push(value)
        break
      case 'like':
        conditions.push(`${column} LIKE $${paramIndex}`)
        params.push(value)
        break
      case 'ilike':
        conditions.push(`${column} ILIKE $${paramIndex}`)
        params.push(value)
        break
      case 'in':
        conditions.push(`${column} = ANY($${paramIndex})`)
        params.push(Array.isArray(value) ? value : [value])
        break
      case 'is':
        conditions.push(`${column} IS ${value === 'null' ? 'NULL' : value}`)
        // 'is' doesn't need a param
        break
    }
  })

  return {
    clause: conditions.join(' AND '),
    params,
  }
}

/**
 * F0967: Build ORDER BY clause for raw SQL queries
 */
export function buildOrderByClause(sort: { column: string; direction: SortDirection } | null): string {
  if (!sort) return ''
  return `ORDER BY ${sort.column} ${sort.direction.toUpperCase()}`
}

/**
 * Common filter presets
 */
export const FilterPresets = {
  /**
   * F0968: Active records filter
   */
  active: (): FilterCondition => ({
    column: 'status',
    operator: 'neq',
    value: 'deleted',
  }),

  /**
   * F0968: Date range filter
   */
  dateRange: (column: string, start: string, end: string): FilterCondition[] => [
    { column, operator: 'gte', value: start },
    { column, operator: 'lte', value: end },
  ],

  /**
   * F0968: Organization scoping filter
   */
  orgId: (orgId: string): FilterCondition => ({
    column: 'org_id',
    operator: 'eq',
    value: orgId,
  }),
}
