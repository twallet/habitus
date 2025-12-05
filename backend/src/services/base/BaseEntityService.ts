import { Database } from "../../db/database.js";

/**
 * Abstract base class for entity service operations.
 * Provides common CRUD patterns that can be extended by specific entity services.
 * Uses template method pattern for entity-specific operations.
 * @public
 */
export abstract class BaseEntityService<TData, TModel> {
  /**
   * Database instance.
   * @protected
   */
  protected db: Database;

  /**
   * Create a new BaseEntityService instance.
   * @param db - Database instance
   * @public
   */
  constructor(db: Database) {
    this.db = db;
  }

  /**
   * Load entity model by ID.
   * Must be implemented by subclasses to provide entity-specific loading logic.
   * @param id - The entity ID
   * @param userId - The user ID (for authorization)
   * @returns Promise resolving to entity model or null if not found
   * @protected
   */
  protected abstract loadModelById(
    id: number,
    userId: number
  ): Promise<TModel | null>;

  /**
   * Load all entity models for a user.
   * Must be implemented by subclasses to provide entity-specific loading logic.
   * @param userId - The user ID
   * @returns Promise resolving to array of entity models
   * @protected
   */
  protected abstract loadModelsByUserId(userId: number): Promise<TModel[]>;

  /**
   * Convert entity model to data object.
   * Must be implemented by subclasses to provide entity-specific conversion logic.
   * @param model - The entity model instance
   * @returns Entity data object
   * @protected
   */
  protected abstract toData(model: TModel): TData;

  /**
   * Get entity name for logging purposes.
   * Must be implemented by subclasses.
   * @returns Entity name (e.g., "TRACKING", "REMINDER")
   * @protected
   */
  protected abstract getEntityName(): string;

  /**
   * Get entity by ID.
   * Provides common pattern for fetching entities with authorization check.
   * @param id - The entity ID
   * @param userId - The user ID (for authorization)
   * @returns Promise resolving to entity data or null if not found
   * @public
   */
  async getById(id: number, userId: number): Promise<TData | null> {
    const entityName = this.getEntityName();
    console.log(
      `[${new Date().toISOString()}] ${entityName} | Fetching ${entityName.toLowerCase()} by ID: ${id} for userId: ${userId}`
    );

    const model = await this.loadModelById(id, userId);

    if (!model) {
      console.log(
        `[${new Date().toISOString()}] ${entityName} | ${entityName} not found for ID: ${id} and userId: ${userId}`
      );
      return null;
    }

    console.log(
      `[${new Date().toISOString()}] ${entityName} | ${entityName} found: ID ${id}`
    );

    return this.toData(model);
  }

  /**
   * Get all entities for a user.
   * Provides common pattern for fetching all user entities.
   * @param userId - The user ID
   * @returns Promise resolving to array of entity data
   * @public
   */
  async getAllByUserId(userId: number): Promise<TData[]> {
    const entityName = this.getEntityName();
    console.log(
      `[${new Date().toISOString()}] ${entityName} | Fetching ${entityName.toLowerCase()}s for userId: ${userId}`
    );

    const models = await this.loadModelsByUserId(userId);

    console.log(
      `[${new Date().toISOString()}] ${entityName} | Retrieved ${
        models.length
      } ${entityName.toLowerCase()}(s) for userId: ${userId}`
    );

    return models.map((model) => this.toData(model));
  }
}
