import { Mutex } from 'async-mutex';

/**
 * In-Memory Key-Value store with concurrency safety using async-mutex
 * Stores only JSON objects (not null, not arrays, not primitives)
 */
class MemoryStore {
	private store = new Map<string, Record<string, any>>();
	private mutex = new Mutex();

	/**
	 * Set a key-value pair in the store
	 * @param key - The key to store
	 * @param value - The value to store (must be a JSON object)
	 * @throws Error if value is not a valid JSON object
	 */
	async set(key: string, value: Record<string, any>): Promise<void> {
		// Validate that value is a non-null object and not an array
		if (typeof value !== 'object' || value === null || Array.isArray(value)) {
			throw new Error('Value must be a non-null JSON object (not array, not primitive, not null)');
		}

		await this.mutex.runExclusive(() => {
			this.store.set(key, { ...value }); // Store a copy to avoid references
		});
	}

	/**
	 * Get a value from the store
	 * @param key - The key to retrieve
	 * @returns The stored value or null if not found
	 */
	async get(key: string): Promise<Record<string, any> | null> {
		return this.mutex.runExclusive(() => {
			const value = this.store.get(key);
			return value ? { ...value } : null; // Return a copy to avoid references
		});
	}

	/**
	 * Delete a key from the store
	 * @param key - The key to delete
	 */
	async delete(key: string): Promise<void> {
		await this.mutex.runExclusive(() => {
			this.store.delete(key);
		});
	}

	/**
	 * Get the current number of keys in the store (for testing purposes)
	 */
	async size(): Promise<number> {
		return this.mutex.runExclusive(() => {
			return this.store.size;
		});
	}

	/**
	 * Clear all keys from the store (for testing purposes)
	 */
	async clear(): Promise<void> {
		await this.mutex.runExclusive(() => {
			this.store.clear();
		});
	}

	/**
	 * Get all keys from the store
	 * @param filterPattern - Optional regex pattern to filter keys
	 * @returns Array of keys that match the filter (or all keys if no filter)
	 */
	async keys(filterPattern?: string): Promise<string[]> {
		return this.mutex.runExclusive(() => {
			const allKeys = Array.from(this.store.keys());

			if (!filterPattern || filterPattern.trim() === '') {
				return allKeys;
			}

			try {
				const regex = new RegExp(filterPattern);
				return allKeys.filter(key => regex.test(key));
			} catch (error) {
				// If regex is invalid, return all keys
				return allKeys;
			}
		});
	}
}

// Export singleton instance
export const memoryStore = new MemoryStore();
