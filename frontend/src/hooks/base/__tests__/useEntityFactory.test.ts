// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useEntityFactory } from "../useEntityFactory.js";
import { EntityHookConfig } from "../types.js";
import { tokenManager } from "../TokenManager.js";

/**
 * Mock entity data type for testing.
 */
interface TestEntityData {
  id: number;
  name: string;
  value?: string;
}

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
});

// Mock tokenManager methods
vi.mock("../TokenManager.js", () => {
  const mockTokenManager = {
    getToken: vi.fn(),
    startPolling: vi.fn(),
    onTokenChange: vi.fn(),
  };
  return {
    tokenManager: mockTokenManager,
  };
});

describe("useEntityFactory", () => {
  let stopPollingMock: ReturnType<typeof vi.fn>;
  let unsubscribeMock: ReturnType<typeof vi.fn>;
  let pollingCallback: ((token: string | null) => void) | null = null;
  let tokenChangeCallback: ((token: string | null) => void) | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue("test-token");

    stopPollingMock = vi.fn();
    unsubscribeMock = vi.fn();

    // Setup tokenManager mocks
    (tokenManager.getToken as ReturnType<typeof vi.fn>).mockReturnValue(
      "test-token"
    );
    (tokenManager.startPolling as ReturnType<typeof vi.fn>).mockImplementation(
      (callback) => {
        pollingCallback = callback;
        return stopPollingMock;
      }
    );
    (tokenManager.onTokenChange as ReturnType<typeof vi.fn>).mockImplementation(
      (callback) => {
        tokenChangeCallback = callback;
        return unsubscribeMock;
      }
    );
  });

  afterEach(() => {
    pollingCallback = null;
    tokenChangeCallback = null;
  });

  describe("Entity Loading", () => {
    it("should create hook that loads entities", async () => {
      const mockEntities: TestEntityData[] = [
        { id: 1, name: "Entity 1" },
        { id: 2, name: "Entity 2" },
      ];

      const config: EntityHookConfig<TestEntityData> = {
        entityName: "TEST",
        fetchAll: vi.fn().mockResolvedValue(mockEntities),
      };

      const useTestEntity = useEntityFactory(config);
      const { result } = renderHook(() => useTestEntity());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.entities).toEqual(mockEntities);
      expect(config.fetchAll).toHaveBeenCalled();
    });

    it("should clear entities when no token is found", async () => {
      (tokenManager.getToken as ReturnType<typeof vi.fn>).mockReturnValue(null);

      const config: EntityHookConfig<TestEntityData> = {
        entityName: "TEST",
        fetchAll: vi.fn().mockResolvedValue([]),
      };

      const useTestEntity = useEntityFactory(config);
      const { result } = renderHook(() => useTestEntity());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.entities).toEqual([]);
      expect(config.fetchAll).not.toHaveBeenCalled();
    });

    it("should handle errors when loading entities", async () => {
      const error = new Error("Failed to load entities");
      const config: EntityHookConfig<TestEntityData> = {
        entityName: "TEST",
        fetchAll: vi.fn().mockRejectedValue(error),
      };

      const useTestEntity = useEntityFactory(config);
      const { result } = renderHook(() => useTestEntity());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.entities).toEqual([]);
      expect(config.fetchAll).toHaveBeenCalled();
    });

    it("should set loading state during fetch", async () => {
      let resolveFetch: (value: TestEntityData[]) => void;
      const fetchPromise = new Promise<TestEntityData[]>((resolve) => {
        resolveFetch = resolve;
      });

      const config: EntityHookConfig<TestEntityData> = {
        entityName: "TEST",
        fetchAll: vi.fn().mockReturnValue(fetchPromise),
      };

      const useTestEntity = useEntityFactory(config);
      const { result } = renderHook(() => useTestEntity());

      // Should be loading initially
      expect(result.current.isLoading).toBe(true);

      // Resolve the promise
      act(() => {
        resolveFetch!([{ id: 1, name: "Entity 1" }]);
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });
  });

  describe("Token Change Handling", () => {
    it("should reload entities when token changes via polling", async () => {
      const mockEntities: TestEntityData[] = [{ id: 1, name: "Entity 1" }];

      const config: EntityHookConfig<TestEntityData> = {
        entityName: "TEST",
        fetchAll: vi.fn().mockResolvedValue(mockEntities),
      };

      const useTestEntity = useEntityFactory(config);
      const { result } = renderHook(() => useTestEntity());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(config.fetchAll).toHaveBeenCalledTimes(1);

      // Simulate token change via polling
      act(() => {
        (tokenManager.getToken as ReturnType<typeof vi.fn>).mockReturnValue(
          "new-token"
        );
        if (pollingCallback) {
          pollingCallback("new-token");
        }
      });

      await waitFor(() => {
        expect(config.fetchAll).toHaveBeenCalledTimes(2);
      });
    });

    it("should reload entities when token changes via storage event", async () => {
      const mockEntities: TestEntityData[] = [{ id: 1, name: "Entity 1" }];

      const config: EntityHookConfig<TestEntityData> = {
        entityName: "TEST",
        fetchAll: vi.fn().mockResolvedValue(mockEntities),
      };

      const useTestEntity = useEntityFactory(config);
      const { result } = renderHook(() => useTestEntity());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(config.fetchAll).toHaveBeenCalledTimes(1);

      // Simulate token change via storage event
      act(() => {
        if (tokenChangeCallback) {
          tokenChangeCallback("new-token");
        }
      });

      await waitFor(() => {
        expect(config.fetchAll).toHaveBeenCalledTimes(2);
      });
    });

    it("should not reload entities when token hasn't changed", async () => {
      const mockEntities: TestEntityData[] = [{ id: 1, name: "Entity 1" }];

      const config: EntityHookConfig<TestEntityData> = {
        entityName: "TEST",
        fetchAll: vi.fn().mockResolvedValue(mockEntities),
      };

      const useTestEntity = useEntityFactory(config);
      const { result } = renderHook(() => useTestEntity());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(config.fetchAll).toHaveBeenCalledTimes(1);

      // Simulate polling with same token
      act(() => {
        if (pollingCallback) {
          pollingCallback("test-token");
        }
      });

      // Wait a bit to ensure no additional calls
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(config.fetchAll).toHaveBeenCalledTimes(1);
    });

    it("should cleanup polling and listeners on unmount", () => {
      const config: EntityHookConfig<TestEntityData> = {
        entityName: "TEST",
        fetchAll: vi.fn().mockResolvedValue([]),
      };

      const useTestEntity = useEntityFactory(config);
      const { unmount } = renderHook(() => useTestEntity());

      expect(tokenManager.startPolling).toHaveBeenCalled();
      expect(tokenManager.onTokenChange).toHaveBeenCalled();

      unmount();

      expect(stopPollingMock).toHaveBeenCalled();
      expect(unsubscribeMock).toHaveBeenCalled();
    });
  });

  describe("Create Entity", () => {
    it("should provide createEntity function when configured", async () => {
      const newEntity: TestEntityData = { id: 3, name: "New Entity" };

      const config: EntityHookConfig<TestEntityData> = {
        entityName: "TEST",
        fetchAll: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue(newEntity),
      };

      const useTestEntity = useEntityFactory(config);
      const { result } = renderHook(() => useTestEntity());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.createEntity).toBeDefined();
      if (result.current.createEntity) {
        await act(async () => {
          await result.current.createEntity!({ name: "New Entity" });
        });
        expect(config.create).toHaveBeenCalledWith({ name: "New Entity" });
        expect(result.current.entities).toContainEqual(newEntity);
      }
    });

    it("should throw error when createEntity is called but not configured", async () => {
      const config: EntityHookConfig<TestEntityData> = {
        entityName: "TEST",
        fetchAll: vi.fn().mockResolvedValue([]),
      };

      const useTestEntity = useEntityFactory(config);
      const { result } = renderHook(() => useTestEntity());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.createEntity).toBeUndefined();
    });

    it("should throw error when not authenticated", async () => {
      const newEntity: TestEntityData = { id: 3, name: "New Entity" };

      const config: EntityHookConfig<TestEntityData> = {
        entityName: "TEST",
        fetchAll: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue(newEntity),
      };

      const useTestEntity = useEntityFactory(config);
      const { result } = renderHook(() => useTestEntity());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      (tokenManager.getToken as ReturnType<typeof vi.fn>).mockReturnValue(null);

      if (result.current.createEntity) {
        await expect(
          act(async () => {
            await result.current.createEntity!({ name: "New Entity" });
          })
        ).rejects.toThrow("Not authenticated");
      }
    });

    it("should use optimistic create when configured", async () => {
      const newEntity: TestEntityData = { id: 3, name: "New Entity" };
      const optimisticEntity: TestEntityData = {
        id: 3,
        name: "Optimistic Entity",
      };

      const config: EntityHookConfig<TestEntityData> = {
        entityName: "TEST",
        fetchAll: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue(newEntity),
        optimisticCreate: vi.fn().mockReturnValue(optimisticEntity),
      };

      const useTestEntity = useEntityFactory(config);
      const { result } = renderHook(() => useTestEntity());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      if (result.current.createEntity) {
        await act(async () => {
          await result.current.createEntity!({ name: "New Entity" });
        });
        expect(config.optimisticCreate).toHaveBeenCalled();
        expect(result.current.entities).toContainEqual(optimisticEntity);
      }
    });

    it("should handle errors when creating entity", async () => {
      const error = new Error("Failed to create entity");
      const config: EntityHookConfig<TestEntityData> = {
        entityName: "TEST",
        fetchAll: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockRejectedValue(error),
      };

      const useTestEntity = useEntityFactory(config);
      const { result } = renderHook(() => useTestEntity());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      if (result.current.createEntity) {
        await expect(
          act(async () => {
            await result.current.createEntity!({ name: "New Entity" });
          })
        ).rejects.toThrow("Failed to create entity");
      }
    });
  });

  describe("Update Entity", () => {
    it("should provide updateEntity function when configured", async () => {
      const existingEntity: TestEntityData = { id: 1, name: "Entity 1" };
      const updatedEntity: TestEntityData = { id: 1, name: "Updated Entity" };

      const config: EntityHookConfig<TestEntityData> = {
        entityName: "TEST",
        fetchAll: vi.fn().mockResolvedValue([existingEntity]),
        update: vi.fn().mockResolvedValue(updatedEntity),
      };

      const useTestEntity = useEntityFactory(config);
      const { result } = renderHook(() => useTestEntity());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.updateEntity).toBeDefined();
      if (result.current.updateEntity) {
        await act(async () => {
          await result.current.updateEntity!(1, { name: "Updated Entity" });
        });
        expect(config.update).toHaveBeenCalledWith(1, {
          name: "Updated Entity",
        });
        expect(result.current.entities).toContainEqual(updatedEntity);
        expect(result.current.entities).not.toContainEqual(existingEntity);
      }
    });

    it("should throw error when updateEntity is called but not configured", async () => {
      const config: EntityHookConfig<TestEntityData> = {
        entityName: "TEST",
        fetchAll: vi.fn().mockResolvedValue([]),
      };

      const useTestEntity = useEntityFactory(config);
      const { result } = renderHook(() => useTestEntity());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.updateEntity).toBeUndefined();
    });

    it("should throw error when not authenticated", async () => {
      const config: EntityHookConfig<TestEntityData> = {
        entityName: "TEST",
        fetchAll: vi.fn().mockResolvedValue([]),
        update: vi.fn().mockResolvedValue({ id: 1, name: "Updated" }),
      };

      const useTestEntity = useEntityFactory(config);
      const { result } = renderHook(() => useTestEntity());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      (tokenManager.getToken as ReturnType<typeof vi.fn>).mockReturnValue(null);

      if (result.current.updateEntity) {
        await expect(
          act(async () => {
            await result.current.updateEntity!(1, { name: "Updated" });
          })
        ).rejects.toThrow("Not authenticated");
      }
    });

    it("should use optimistic update when configured", async () => {
      const existingEntity: TestEntityData = { id: 1, name: "Entity 1" };
      const updatedEntity: TestEntityData = { id: 1, name: "Updated Entity" };
      const optimisticEntities: TestEntityData[] = [
        { id: 1, name: "Optimistic Updated" },
      ];

      const config: EntityHookConfig<TestEntityData> = {
        entityName: "TEST",
        fetchAll: vi.fn().mockResolvedValue([existingEntity]),
        update: vi.fn().mockResolvedValue(updatedEntity),
        optimisticUpdate: vi.fn().mockReturnValue(optimisticEntities),
      };

      const useTestEntity = useEntityFactory(config);
      const { result } = renderHook(() => useTestEntity());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      if (result.current.updateEntity) {
        await act(async () => {
          await result.current.updateEntity!(1, { name: "Updated Entity" });
        });
        expect(config.optimisticUpdate).toHaveBeenCalled();
        expect(result.current.entities).toEqual([updatedEntity]);
      }
    });

    it("should handle errors when updating entity and reload entities", async () => {
      const existingEntity: TestEntityData = { id: 1, name: "Entity 1" };
      const error = new Error("Failed to update entity");
      const reloadedEntities: TestEntityData[] = [
        { id: 1, name: "Reloaded Entity" },
      ];

      const config: EntityHookConfig<TestEntityData> = {
        entityName: "TEST",
        fetchAll: vi
          .fn()
          .mockResolvedValueOnce([existingEntity])
          .mockResolvedValueOnce(reloadedEntities),
        update: vi.fn().mockRejectedValue(error),
      };

      const useTestEntity = useEntityFactory(config);
      const { result } = renderHook(() => useTestEntity());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      if (result.current.updateEntity) {
        await expect(
          act(async () => {
            await result.current.updateEntity!(1, { name: "Updated" });
          })
        ).rejects.toThrow("Failed to update entity");

        await waitFor(() => {
          expect(config.fetchAll).toHaveBeenCalledTimes(2);
        });
      }
    });
  });

  describe("Delete Entity", () => {
    it("should provide deleteEntity function when configured", async () => {
      const existingEntity: TestEntityData = { id: 1, name: "Entity 1" };

      const config: EntityHookConfig<TestEntityData> = {
        entityName: "TEST",
        fetchAll: vi.fn().mockResolvedValue([existingEntity]),
        delete: vi.fn().mockResolvedValue(undefined),
      };

      const useTestEntity = useEntityFactory(config);
      const { result } = renderHook(() => useTestEntity());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.deleteEntity).toBeDefined();
      if (result.current.deleteEntity) {
        await act(async () => {
          await result.current.deleteEntity!(1);
        });
        expect(config.delete).toHaveBeenCalledWith(1);
        expect(result.current.entities).not.toContainEqual(existingEntity);
      }
    });

    it("should throw error when deleteEntity is called but not configured", async () => {
      const config: EntityHookConfig<TestEntityData> = {
        entityName: "TEST",
        fetchAll: vi.fn().mockResolvedValue([]),
      };

      const useTestEntity = useEntityFactory(config);
      const { result } = renderHook(() => useTestEntity());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.deleteEntity).toBeUndefined();
    });

    it("should throw error when not authenticated", async () => {
      const config: EntityHookConfig<TestEntityData> = {
        entityName: "TEST",
        fetchAll: vi.fn().mockResolvedValue([]),
        delete: vi.fn().mockResolvedValue(undefined),
      };

      const useTestEntity = useEntityFactory(config);
      const { result } = renderHook(() => useTestEntity());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      (tokenManager.getToken as ReturnType<typeof vi.fn>).mockReturnValue(null);

      if (result.current.deleteEntity) {
        await expect(
          act(async () => {
            await result.current.deleteEntity!(1);
          })
        ).rejects.toThrow("Not authenticated");
      }
    });

    it("should use optimistic delete when configured", async () => {
      const existingEntity: TestEntityData = { id: 1, name: "Entity 1" };
      const remainingEntities: TestEntityData[] = [];

      const config: EntityHookConfig<TestEntityData> = {
        entityName: "TEST",
        fetchAll: vi.fn().mockResolvedValue([existingEntity]),
        delete: vi.fn().mockResolvedValue(undefined),
        optimisticDelete: vi.fn().mockReturnValue(remainingEntities),
      };

      const useTestEntity = useEntityFactory(config);
      const { result } = renderHook(() => useTestEntity());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      if (result.current.deleteEntity) {
        await act(async () => {
          await result.current.deleteEntity!(1);
        });
        expect(config.optimisticDelete).toHaveBeenCalled();
        expect(result.current.entities).toEqual(remainingEntities);
      }
    });

    it("should handle errors when deleting entity and reload entities", async () => {
      const existingEntity: TestEntityData = { id: 1, name: "Entity 1" };
      const error = new Error("Failed to delete entity");
      const reloadedEntities: TestEntityData[] = [existingEntity];

      const config: EntityHookConfig<TestEntityData> = {
        entityName: "TEST",
        fetchAll: vi
          .fn()
          .mockResolvedValueOnce([existingEntity])
          .mockResolvedValueOnce(reloadedEntities),
        delete: vi.fn().mockRejectedValue(error),
      };

      const useTestEntity = useEntityFactory(config);
      const { result } = renderHook(() => useTestEntity());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      if (result.current.deleteEntity) {
        await expect(
          act(async () => {
            await result.current.deleteEntity!(1);
          })
        ).rejects.toThrow("Failed to delete entity");

        await waitFor(() => {
          expect(config.fetchAll).toHaveBeenCalledTimes(2);
        });
      }
    });
  });

  describe("Refresh Entities", () => {
    it("should provide refreshEntities function", async () => {
      const initialEntities: TestEntityData[] = [{ id: 1, name: "Entity 1" }];
      const refreshedEntities: TestEntityData[] = [
        { id: 1, name: "Entity 1" },
        { id: 2, name: "Entity 2" },
      ];

      const config: EntityHookConfig<TestEntityData> = {
        entityName: "TEST",
        fetchAll: vi
          .fn()
          .mockResolvedValueOnce(initialEntities)
          .mockResolvedValueOnce(refreshedEntities),
      };

      const useTestEntity = useEntityFactory(config);
      const { result } = renderHook(() => useTestEntity());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.refreshEntities).toBeDefined();
      expect(result.current.entities).toEqual(initialEntities);

      await act(async () => {
        await result.current.refreshEntities();
      });

      expect(result.current.entities).toEqual(refreshedEntities);
      expect(config.fetchAll).toHaveBeenCalledTimes(2);
    });
  });

  describe("Conditional Return Values", () => {
    it("should only include createEntity when create is configured", async () => {
      const config: EntityHookConfig<TestEntityData> = {
        entityName: "TEST",
        fetchAll: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue({ id: 1, name: "New" }),
      };

      const useTestEntity = useEntityFactory(config);
      const { result } = renderHook(() => useTestEntity());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.createEntity).toBeDefined();
      expect(result.current.updateEntity).toBeUndefined();
      expect(result.current.deleteEntity).toBeUndefined();
    });

    it("should only include updateEntity when update is configured", async () => {
      const config: EntityHookConfig<TestEntityData> = {
        entityName: "TEST",
        fetchAll: vi.fn().mockResolvedValue([]),
        update: vi.fn().mockResolvedValue({ id: 1, name: "Updated" }),
      };

      const useTestEntity = useEntityFactory(config);
      const { result } = renderHook(() => useTestEntity());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.createEntity).toBeUndefined();
      expect(result.current.updateEntity).toBeDefined();
      expect(result.current.deleteEntity).toBeUndefined();
    });

    it("should only include deleteEntity when delete is configured", async () => {
      const config: EntityHookConfig<TestEntityData> = {
        entityName: "TEST",
        fetchAll: vi.fn().mockResolvedValue([]),
        delete: vi.fn().mockResolvedValue(undefined),
      };

      const useTestEntity = useEntityFactory(config);
      const { result } = renderHook(() => useTestEntity());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.createEntity).toBeUndefined();
      expect(result.current.updateEntity).toBeUndefined();
      expect(result.current.deleteEntity).toBeDefined();
    });

    it("should include all functions when all are configured", async () => {
      const config: EntityHookConfig<TestEntityData> = {
        entityName: "TEST",
        fetchAll: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue({ id: 1, name: "New" }),
        update: vi.fn().mockResolvedValue({ id: 1, name: "Updated" }),
        delete: vi.fn().mockResolvedValue(undefined),
      };

      const useTestEntity = useEntityFactory(config);
      const { result } = renderHook(() => useTestEntity());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.createEntity).toBeDefined();
      expect(result.current.updateEntity).toBeDefined();
      expect(result.current.deleteEntity).toBeDefined();
    });
  });
});
