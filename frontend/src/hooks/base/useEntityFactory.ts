import { useState, useEffect, useCallback } from "react";
import { flushSync } from "react-dom";
import { tokenManager } from "./TokenManager.js";
import { EntityHookConfig, EntityHookReturn } from "./types.js";

/**
 * Factory function to create entity-specific hooks.
 * Provides shared patterns for loading state, error handling, optimistic updates, and token management.
 * @param config - Entity hook configuration
 * @returns Hook function for managing entities
 * @public
 */
export function useEntityFactory<TData>(config: EntityHookConfig<TData>) {
  return function useEntity(): EntityHookReturn<TData> {
    const [entities, setEntities] = useState<TData[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [currentToken, setCurrentToken] = useState<string | null>(() =>
      tokenManager.getToken()
    );

    /**
     * Load entities from API.
     * @internal
     */
    const loadEntities = useCallback(async () => {
      const token = tokenManager.getToken();
      if (!token) {
        console.warn(
          `[${new Date().toISOString()}] FRONTEND_${
            config.entityName
          } | No auth token found, clearing entities`
        );
        setEntities([]);
        setCurrentToken(null);
        return;
      }

      setIsLoading(true);
      console.log(
        `[${new Date().toISOString()}] FRONTEND_${
          config.entityName
        } | Fetching entities from API`
      );

      try {
        const loadedEntities = await config.fetchAll();
        console.log(
          `[${new Date().toISOString()}] FRONTEND_${
            config.entityName
          } | Loaded ${loadedEntities.length} entities from API`
        );
        setEntities(loadedEntities);
        setCurrentToken(token);
      } catch (error) {
        console.error(
          `[${new Date().toISOString()}] FRONTEND_${
            config.entityName
          } | Error loading entities:`,
          error
        );
        setEntities([]);
        setCurrentToken(null);
      } finally {
        setIsLoading(false);
      }
    }, [config]);

    /**
     * Load entities on mount and when token changes.
     * @internal
     */
    useEffect(() => {
      loadEntities();
    }, [loadEntities]);

    /**
     * Watch for token changes using polling and storage events.
     * @internal
     */
    useEffect(() => {
      // Poll for token changes (handles same-tab login/logout)
      const stopPolling = tokenManager.startPolling((token) => {
        if (token !== currentToken) {
          loadEntities();
        }
      });

      // Listen for storage events (handles cross-tab changes)
      const unsubscribe = tokenManager.onTokenChange((token) => {
        if (token !== currentToken) {
          loadEntities();
        }
      });

      return () => {
        stopPolling();
        unsubscribe();
      };
    }, [currentToken, loadEntities]);

    /**
     * Create an entity via API.
     * @param data - Entity data to create
     * @returns The created entity data
     * @throws Error if API request fails
     * @public
     */
    const createEntity = useCallback(
      async (data: Partial<TData>): Promise<TData> => {
        if (!config.create) {
          throw new Error("Create operation not configured");
        }

        const token = tokenManager.getToken();
        if (!token) {
          throw new Error("Not authenticated");
        }

        console.log(
          `[${new Date().toISOString()}] FRONTEND_${
            config.entityName
          } | Creating new entity`
        );

        try {
          const entityData = await config.create(data);
          console.log(
            `[${new Date().toISOString()}] FRONTEND_${
              config.entityName
            } | Entity created successfully: ID ${(entityData as any).id}`
          );

          // Optimistic update if configured
          if (config.optimisticCreate) {
            setEntities((prevEntities) => [
              config.optimisticCreate!(prevEntities, data),
              ...prevEntities,
            ]);
          } else {
            // Default: add to beginning of array
            setEntities((prevEntities) => [entityData, ...prevEntities]);
          }

          return entityData;
        } catch (error) {
          console.error(
            `[${new Date().toISOString()}] FRONTEND_${
              config.entityName
            } | Error creating entity:`,
            error
          );
          throw error;
        }
      },
      [config]
    );

    /**
     * Update an entity via API.
     * @param id - Entity ID
     * @param data - Partial entity data to update
     * @returns The updated entity data
     * @throws Error if API request fails
     * @public
     */
    const updateEntity = useCallback(
      async (id: number, data: Partial<TData>): Promise<TData> => {
        if (!config.update) {
          throw new Error("Update operation not configured");
        }

        const token = tokenManager.getToken();
        if (!token) {
          throw new Error("Not authenticated");
        }

        console.log(
          `[${new Date().toISOString()}] FRONTEND_${
            config.entityName
          } | Updating entity ID: ${id}`
        );

        // Optimistic update if configured
        if (config.optimisticUpdate) {
          flushSync(() => {
            setEntities((prevEntities) =>
              config.optimisticUpdate!(prevEntities, { id, data })
            );
          });
        }

        try {
          const entityData = await config.update(id, data);
          console.log(
            `[${new Date().toISOString()}] FRONTEND_${
              config.entityName
            } | Entity updated successfully: ID ${id}`
          );

          // Update with server response to ensure consistency
          setEntities((prevEntities) =>
            prevEntities.map((e) => ((e as any).id === id ? entityData : e))
          );

          return entityData;
        } catch (error) {
          console.error(
            `[${new Date().toISOString()}] FRONTEND_${
              config.entityName
            } | Error updating entity:`,
            error
          );
          // On error, refresh to restore correct state
          await loadEntities();
          throw error;
        }
      },
      [config, loadEntities]
    );

    /**
     * Delete an entity via API.
     * @param id - Entity ID to delete
     * @returns Promise resolving when entity is deleted
     * @throws Error if API request fails
     * @public
     */
    const deleteEntity = useCallback(
      async (id: number): Promise<void> => {
        if (!config.delete) {
          throw new Error("Delete operation not configured");
        }

        const token = tokenManager.getToken();
        if (!token) {
          throw new Error("Not authenticated");
        }

        console.log(
          `[${new Date().toISOString()}] FRONTEND_${
            config.entityName
          } | Deleting entity ID: ${id}`
        );

        // Optimistic update if configured
        if (config.optimisticDelete) {
          setEntities((prevEntities) =>
            config.optimisticDelete!(prevEntities, id)
          );
        } else {
          // Default: remove from array
          setEntities((prevEntities) =>
            prevEntities.filter((e) => (e as any).id !== id)
          );
        }

        try {
          await config.delete(id);
          console.log(
            `[${new Date().toISOString()}] FRONTEND_${
              config.entityName
            } | Entity deleted successfully: ID ${id}`
          );
        } catch (error) {
          console.error(
            `[${new Date().toISOString()}] FRONTEND_${
              config.entityName
            } | Error deleting entity:`,
            error
          );
          // On error, refresh to restore correct state
          await loadEntities();
          throw error;
        }
      },
      [config, loadEntities]
    );

    /**
     * Refresh entities from API.
     * @public
     */
    const refreshEntities = useCallback(async () => {
      await loadEntities();
    }, [loadEntities]);

    // Build return object based on configuration
    const returnValue: EntityHookReturn<TData> = {
      entities,
      isLoading,
      refreshEntities,
    };

    if (config.create) {
      returnValue.createEntity = createEntity;
    }

    if (config.update) {
      returnValue.updateEntity = updateEntity;
    }

    if (config.delete) {
      returnValue.deleteEntity = deleteEntity;
    }

    return returnValue;
  };
}
