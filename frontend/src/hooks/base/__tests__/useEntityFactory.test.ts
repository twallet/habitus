// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useEntityFactory } from "../useEntityFactory.js";
import { EntityHookConfig } from "../types.js";

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

describe("useEntityFactory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue("test-token");
  });

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
      await result.current.createEntity({ name: "New Entity" });
      expect(config.create).toHaveBeenCalled();
    }
  });
});
