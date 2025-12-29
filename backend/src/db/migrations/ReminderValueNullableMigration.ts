import { Database } from "../database.js";

/**
 * Migration class for making reminder.value nullable.
 * Follows OOP principles by encapsulating migration logic in a class.
 * @public
 */
export class ReminderValueNullableMigration {
  /**
   * Database instance.
   * @private
   */
  private db: Database;

  /**
   * Create a new migration instance.
   * @param db - Database instance
   * @public
   */
  constructor(db: Database) {
    this.db = db;
  }

  /**
   * Execute the migration.
   * Updates existing data and modifies schema to allow NULL values.
   * @returns Promise resolving when migration completes
   * @throws Error if migration fails
   * @public
   */
  async execute(): Promise<void> {
    // Step 1: Update existing data - set value to NULL for non-answered reminders
    await this.updateExistingData();

    // Step 2: Recreate table with new schema
    await this.recreateTable();
  }

  /**
   * Update existing reminders: set value to NULL where status != 'Answered'.
   * @private
   */
  private async updateExistingData(): Promise<void> {
    await this.db.run(`UPDATE reminders SET value = NULL WHERE status != ?`, [
      "Answered",
    ]);
  }

  /**
   * Recreate reminders table with nullable value column.
   * SQLite doesn't support ALTER COLUMN, so we recreate the table.
   * @private
   */
  private async recreateTable(): Promise<void> {
    // Create new table with correct schema
    await this.db.run(`
      CREATE TABLE reminders_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tracking_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        scheduled_time DATETIME NOT NULL,
        notes TEXT,
        status TEXT NOT NULL DEFAULT 'Pending' CHECK(status IN ('Pending', 'Answered', 'Upcoming')),
        value TEXT CHECK(value IN ('Completed', 'Dismissed') OR value IS NULL),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tracking_id) REFERENCES trackings(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CHECK(
          (status = 'Answered' AND value IS NOT NULL) OR
          (status != 'Answered' AND value IS NULL)
        )
      );
    `);

    // Copy data from old table
    await this.db.run(`
      INSERT INTO reminders_new 
      SELECT id, tracking_id, user_id, scheduled_time, notes, status, value, created_at, updated_at
      FROM reminders;
    `);

    // Drop old table
    await this.db.run(`DROP TABLE reminders;`);

    // Rename new table
    await this.db.run(`ALTER TABLE reminders_new RENAME TO reminders;`);

    // Recreate indexes
    await this.recreateIndexes();
  }

  /**
   * Recreate indexes for reminders table.
   * @private
   */
  private async recreateIndexes(): Promise<void> {
    await this.db.run(
      `CREATE INDEX IF NOT EXISTS idx_reminders_user_id ON reminders(user_id);`
    );
    await this.db.run(
      `CREATE INDEX IF NOT EXISTS idx_reminders_tracking_id ON reminders(tracking_id);`
    );
    await this.db.run(
      `CREATE INDEX IF NOT EXISTS idx_reminders_scheduled_time ON reminders(scheduled_time);`
    );
    await this.db.run(
      `CREATE INDEX IF NOT EXISTS idx_reminders_status ON reminders(status);`
    );
  }
}
