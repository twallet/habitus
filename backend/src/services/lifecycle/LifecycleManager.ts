/**
 * Type for lifecycle event handlers.
 * @public
 */
export type LifecycleEventHandler<TEntity> = (
  entity: TEntity
) => Promise<void> | void;

/**
 * Type for lifecycle transition handlers.
 * Called before and after state transitions.
 * @public
 */
export type LifecycleTransitionHandler<TEntity, TState> = (
  entity: TEntity,
  fromState: TState,
  toState: TState
) => Promise<void> | void;

/**
 * Abstract base class for managing entity lifecycles with state machine pattern.
 * Provides hooks for lifecycle events and validates state transitions.
 * @public
 */
export abstract class LifecycleManager<TEntity, TState> {
  /**
   * Lifecycle event handlers.
   * @private
   */
  private onCreateHandlers: LifecycleEventHandler<TEntity>[] = [];
  private onUpdateHandlers: LifecycleEventHandler<TEntity>[] = [];
  private onDeleteHandlers: LifecycleEventHandler<TEntity>[] = [];
  private onBeforeStateChangeHandlers: LifecycleTransitionHandler<
    TEntity,
    TState
  >[] = [];
  private onAfterStateChangeHandlers: LifecycleTransitionHandler<
    TEntity,
    TState
  >[] = [];

  /**
   * Register a handler for entity creation.
   * @param handler - Handler function called after entity is created
   * @public
   */
  registerOnCreate(handler: LifecycleEventHandler<TEntity>): void {
    this.onCreateHandlers.push(handler);
  }

  /**
   * Register a handler for entity updates.
   * @param handler - Handler function called after entity is updated
   * @public
   */
  registerOnUpdate(handler: LifecycleEventHandler<TEntity>): void {
    this.onUpdateHandlers.push(handler);
  }

  /**
   * Register a handler for entity deletion.
   * @param handler - Handler function called after entity is deleted
   * @public
   */
  registerOnDelete(handler: LifecycleEventHandler<TEntity>): void {
    this.onDeleteHandlers.push(handler);
  }

  /**
   * Register a handler called before state transition.
   * @param handler - Handler function called before state change
   * @public
   */
  registerOnBeforeStateChange(
    handler: LifecycleTransitionHandler<TEntity, TState>
  ): void {
    this.onBeforeStateChangeHandlers.push(handler);
  }

  /**
   * Register a handler called after state transition.
   * @param handler - Handler function called after state change
   * @public
   */
  registerOnAfterStateChange(
    handler: LifecycleTransitionHandler<TEntity, TState>
  ): void {
    this.onAfterStateChangeHandlers.push(handler);
  }

  /**
   * Execute onCreate handlers.
   * @param entity - The created entity
   * @protected
   */
  protected async executeOnCreate(entity: TEntity): Promise<void> {
    for (const handler of this.onCreateHandlers) {
      await handler(entity);
    }
  }

  /**
   * Trigger onCreate lifecycle event.
   * Call this after creating an entity to execute onCreate handlers.
   * @param entity - The created entity
   * @public
   */
  async onCreate(entity: TEntity): Promise<void> {
    await this.executeOnCreate(entity);
  }

  /**
   * Execute onUpdate handlers.
   * @param entity - The updated entity
   * @protected
   */
  protected async executeOnUpdate(entity: TEntity): Promise<void> {
    for (const handler of this.onUpdateHandlers) {
      await handler(entity);
    }
  }

  /**
   * Execute onDelete handlers.
   * @param entity - The deleted entity
   * @protected
   */
  protected async executeOnDelete(entity: TEntity): Promise<void> {
    for (const handler of this.onDeleteHandlers) {
      await handler(entity);
    }
  }

  /**
   * Execute onBeforeStateChange handlers.
   * @param entity - The entity being transitioned
   * @param fromState - Current state
   * @param toState - Target state
   * @protected
   */
  protected async executeOnBeforeStateChange(
    entity: TEntity,
    fromState: TState,
    toState: TState
  ): Promise<void> {
    for (const handler of this.onBeforeStateChangeHandlers) {
      await handler(entity, fromState, toState);
    }
  }

  /**
   * Execute onAfterStateChange handlers.
   * @param entity - The entity after transition
   * @param fromState - Previous state
   * @param toState - New state
   * @protected
   */
  protected async executeOnAfterStateChange(
    entity: TEntity,
    fromState: TState,
    toState: TState
  ): Promise<void> {
    for (const handler of this.onAfterStateChangeHandlers) {
      await handler(entity, fromState, toState);
    }
  }

  /**
   * Get current state from entity.
   * Must be implemented by subclasses.
   * @param entity - The entity
   * @returns Current state
   * @protected
   */
  protected abstract getCurrentState(entity: TEntity): TState;

  /**
   * Validate if a state transition is allowed.
   * Must be implemented by subclasses.
   * @param fromState - Current state
   * @param toState - Target state
   * @throws Error if transition is invalid
   * @protected
   */
  protected abstract validateTransition(
    fromState: TState,
    toState: TState
  ): void;

  /**
   * Execute a state transition with validation and hooks.
   * @param entity - The entity to transition
   * @param toState - Target state
   * @returns Promise resolving when transition is complete
   * @throws Error if transition is invalid
   * @public
   */
  async transition(entity: TEntity, toState: TState): Promise<void> {
    const fromState = this.getCurrentState(entity);

    // Validate transition
    this.validateTransition(fromState, toState);

    // Execute before hooks
    await this.executeOnBeforeStateChange(entity, fromState, toState);

    // Transition is executed by the caller (service)
    // We just provide the hooks

    // Execute after hooks (should be called by service after state is updated)
    // This is a design decision - hooks are called by service after actual state change
  }

  /**
   * Execute after state change hooks (called by service after state is updated).
   * @param entity - The entity after transition
   * @param fromState - Previous state
   * @param toState - New state
   * @public
   */
  async afterStateChange(
    entity: TEntity,
    fromState: TState,
    toState: TState
  ): Promise<void> {
    await this.executeOnAfterStateChange(entity, fromState, toState);
  }
}
