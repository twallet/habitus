/**
 * Configuration for entity-specific operations.
 * @public
 */
export interface EntityHookConfig<TData> {
  /**
   * Entity name for logging (e.g., "TRACKINGS", "REMINDERS").
   */
  entityName: string;

  /**
   * Function to fetch all entities from API.
   */
  fetchAll: () => Promise<TData[]>;

  /**
   * Function to create an entity via API.
   * @param data - Entity data to create
   */
  create?: (data: Partial<TData>) => Promise<TData>;

  /**
   * Function to update an entity via API.
   * @param id - Entity ID
   * @param data - Partial entity data to update
   */
  update?: (id: number, data: Partial<TData>) => Promise<TData>;

  /**
   * Function to delete an entity via API.
   * @param id - Entity ID
   */
  delete?: (id: number) => Promise<void>;

  /**
   * Optional function to refresh entities (custom refresh logic).
   * If not provided, uses fetchAll.
   */
  refresh?: () => Promise<TData[]>;

  /**
   * Optional function for optimistic updates.
   * Should return the optimistically updated entity.
   * @param currentEntities - Current entities array
   * @param updates - Update data
   */
  optimisticUpdate?: (
    currentEntities: TData[],
    updates: { id: number; data: Partial<TData> }
  ) => TData[];

  /**
   * Optional function for optimistic creation.
   * Should return the optimistically created entity.
   * @param currentEntities - Current entities array
   * @param data - New entity data
   */
  optimisticCreate?: (currentEntities: TData[], data: Partial<TData>) => TData;

  /**
   * Optional function for optimistic deletion.
   * Should return entities array with item removed.
   * @param currentEntities - Current entities array
   * @param id - Entity ID to remove
   */
  optimisticDelete?: (currentEntities: TData[], id: number) => TData[];
}

/**
 * Return type for entity hook.
 * @public
 */
export interface EntityHookReturn<TData> {
  /**
   * Array of entities.
   */
  entities: TData[];

  /**
   * Loading state.
   */
  isLoading: boolean;

  /**
   * Create entity function (if configured).
   */
  createEntity?: (data: Partial<TData>) => Promise<TData>;

  /**
   * Update entity function (if configured).
   */
  updateEntity?: (id: number, data: Partial<TData>) => Promise<TData>;

  /**
   * Delete entity function (if configured).
   */
  deleteEntity?: (id: number) => Promise<void>;

  /**
   * Refresh entities function.
   */
  refreshEntities: () => Promise<void>;
}
