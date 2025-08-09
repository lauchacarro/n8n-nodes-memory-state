import { memoryStore } from '../src/MemoryStore';

describe('MemoryStore', () => {
  beforeEach(async () => {
    // Clear the store before each test
    await memoryStore.clear();
  });

  describe('set operation', () => {
    it('should store a valid JSON object', async () => {
      const key = 'test-key';
      const value = { userId: 123, state: 'active' };

      await memoryStore.set(key, value);
      const result = await memoryStore.get(key);

      expect(result).toEqual(value);
    });

    it('should reject null values', async () => {
      const key = 'test-key';

      await expect(memoryStore.set(key, null as any)).rejects.toThrow(
        'Value must be a non-null JSON object (not array, not primitive, not null)'
      );
    });

    it('should reject array values', async () => {
      const key = 'test-key';
      const value = [1, 2, 3];

      await expect(memoryStore.set(key, value as any)).rejects.toThrow(
        'Value must be a non-null JSON object (not array, not primitive, not null)'
      );
    });

    it('should reject primitive values', async () => {
      const key = 'test-key';

      await expect(memoryStore.set(key, 'string' as any)).rejects.toThrow(
        'Value must be a non-null JSON object (not array, not primitive, not null)'
      );

      await expect(memoryStore.set(key, 123 as any)).rejects.toThrow(
        'Value must be a non-null JSON object (not array, not primitive, not null)'
      );

      await expect(memoryStore.set(key, true as any)).rejects.toThrow(
        'Value must be a non-null JSON object (not array, not primitive, not null)'
      );
    });

    it('should overwrite existing values', async () => {
      const key = 'test-key';
      const value1 = { count: 1 };
      const value2 = { count: 2 };

      await memoryStore.set(key, value1);
      await memoryStore.set(key, value2);

      const result = await memoryStore.get(key);
      expect(result).toEqual(value2);
    });

    it('should store independent copies of objects', async () => {
      const key = 'test-key';
      const value = { count: 1 };

      await memoryStore.set(key, value);
      value.count = 2; // Modify original object

      const result = await memoryStore.get(key);
      expect(result?.count).toBe(1); // Should not be affected by external modification
    });
  });

  describe('get operation', () => {
    it('should return null for non-existent keys', async () => {
      const result = await memoryStore.get('non-existent-key');
      expect(result).toBeNull();
    });

    it('should return the stored value for existing keys', async () => {
      const key = 'test-key';
      const value = { userId: 123, state: 'active' };

      await memoryStore.set(key, value);
      const result = await memoryStore.get(key);

      expect(result).toEqual(value);
    });

    it('should return independent copies of stored objects', async () => {
      const key = 'test-key';
      const value = { count: 1 };

      await memoryStore.set(key, value);
      const result = await memoryStore.get(key);

      if (result) {
        result.count = 2; // Modify returned object
      }

      const result2 = await memoryStore.get(key);
      expect(result2?.count).toBe(1); // Should not be affected by external modification
    });
  });

  describe('delete operation', () => {
    it('should delete existing keys', async () => {
      const key = 'test-key';
      const value = { userId: 123 };

      await memoryStore.set(key, value);
      await memoryStore.delete(key);

      const result = await memoryStore.get(key);
      expect(result).toBeNull();
    });

    it('should be silent when deleting non-existent keys', async () => {
      // Should not throw an error
      await expect(memoryStore.delete('non-existent-key')).resolves.toBeUndefined();
    });

    it('should reduce store size when deleting', async () => {
      const key = 'test-key';
      const value = { userId: 123 };

      await memoryStore.set(key, value);
      expect(await memoryStore.size()).toBe(1);

      await memoryStore.delete(key);
      expect(await memoryStore.size()).toBe(0);
    });
  });

  describe('concurrency tests', () => {
    it('should handle concurrent set operations safely', async () => {
      const promises: Promise<void>[] = [];
      const numberOfOperations = 50;

      // Create concurrent set operations with different keys
      for (let i = 0; i < numberOfOperations; i++) {
        promises.push(memoryStore.set(`concurrent-key-${i}`, { value: i }));
      }

      // All operations should complete without throwing errors
      await expect(Promise.all(promises)).resolves.toEqual(
        new Array(numberOfOperations).fill(undefined)
      );

      // Verify all values were stored correctly
      for (let i = 0; i < numberOfOperations; i++) {
        const result = await memoryStore.get(`concurrent-key-${i}`);
        expect(result).toEqual({ value: i });
      }

      expect(await memoryStore.size()).toBe(numberOfOperations);
    });

    it('should handle concurrent operations on the same key safely', async () => {
      const promises: Promise<void>[] = [];
      const numberOfOperations = 50;
      const key = 'concurrent-key';

      // Create concurrent set operations on the same key
      for (let i = 0; i < numberOfOperations; i++) {
        promises.push(memoryStore.set(key, { iteration: i }));
      }

      // All operations should complete without throwing errors
      await expect(Promise.all(promises)).resolves.toEqual(
        new Array(numberOfOperations).fill(undefined)
      );

      // The final value should be one of the set values
      const result = await memoryStore.get(key);
      expect(result).toBeDefined();
      expect(typeof result?.iteration).toBe('number');
      expect(result?.iteration).toBeGreaterThanOrEqual(0);
      expect(result?.iteration).toBeLessThan(numberOfOperations);
    });

    it('should handle mixed concurrent operations safely', async () => {
      const promises: Promise<any>[] = [];
      const numberOfOperations = 100;

      // Mix of set, get, and delete operations
      for (let i = 0; i < numberOfOperations; i++) {
        const key = `mixed-key-${i % 10}`; // Use 10 different keys

        if (i % 3 === 0) {
          // Set operation
          promises.push(memoryStore.set(key, { operation: 'set', iteration: i }));
        } else if (i % 3 === 1) {
          // Get operation
          promises.push(memoryStore.get(key));
        } else {
          // Delete operation
          promises.push(memoryStore.delete(key));
        }
      }

      // All operations should complete without throwing errors
      await expect(Promise.all(promises)).resolves.toBeDefined();

      // Store should still be in a valid state
      const finalSize = await memoryStore.size();
      expect(finalSize).toBeGreaterThanOrEqual(0);
      expect(finalSize).toBeLessThanOrEqual(10);
    });

    it('should maintain data integrity under high concurrency', async () => {
      const promises: Promise<void>[] = [];
      const numberOfKeys = 20;
      const operationsPerKey = 10;

      // Create multiple concurrent operations for each key
      for (let keyIndex = 0; keyIndex < numberOfKeys; keyIndex++) {
        const key = `integrity-key-${keyIndex}`;

        for (let opIndex = 0; opIndex < operationsPerKey; opIndex++) {
          promises.push(memoryStore.set(key, {
            keyIndex,
            opIndex,
            timestamp: Date.now(),
            data: `test-data-${keyIndex}-${opIndex}`
          }));
        }
      }

      // Execute all operations concurrently
      await Promise.all(promises);

      // Verify data integrity
      expect(await memoryStore.size()).toBe(numberOfKeys);

      for (let keyIndex = 0; keyIndex < numberOfKeys; keyIndex++) {
        const key = `integrity-key-${keyIndex}`;
        const result = await memoryStore.get(key);

        expect(result).toBeDefined();
        expect(result?.keyIndex).toBe(keyIndex);
        expect(typeof result?.opIndex).toBe('number');
        expect(typeof result?.timestamp).toBe('number');
        expect(typeof result?.data).toBe('string');
      }
    });
  });

  describe('edge cases', () => {
    it('should handle empty objects', async () => {
      const key = 'empty-object';
      const value = {};

      await memoryStore.set(key, value);
      const result = await memoryStore.get(key);

      expect(result).toEqual({});
    });

    it('should handle complex nested objects', async () => {
      const key = 'complex-object';
      const value = {
        user: {
          id: 123,
          profile: {
            name: 'John Doe',
            settings: {
              theme: 'dark',
              notifications: true
            }
          }
        },
        metadata: {
          created: new Date().toISOString(),
          tags: { important: true, category: 'user' }
        }
      };

      await memoryStore.set(key, value);
      const result = await memoryStore.get(key);

      expect(result).toEqual(value);
    });

    it('should handle keys with special characters', async () => {
      const specialKeys = [
        'key:with:colons',
        'key-with-dashes',
        'key_with_underscores',
        'key with spaces',
        'key.with.dots',
        'key/with/slashes',
        'key@with@symbols'
      ];

      for (const key of specialKeys) {
        const value = { specialKey: key };
        await memoryStore.set(key, value);
        const result = await memoryStore.get(key);
        expect(result).toEqual(value);
      }
    });
  });

  describe('keys operation', () => {
    beforeEach(async () => {
      // Set up some test data
      await memoryStore.set('user:123', { name: 'John' });
      await memoryStore.set('user:456', { name: 'Jane' });
      await memoryStore.set('session:abc', { active: true });
      await memoryStore.set('config:app', { theme: 'dark' });
      await memoryStore.set('temp:xyz', { data: 'test' });
    });

    it('should return all keys when no filter is provided', async () => {
      const keys = await memoryStore.keys();

      expect(keys).toHaveLength(5);
      expect(keys).toContain('user:123');
      expect(keys).toContain('user:456');
      expect(keys).toContain('session:abc');
      expect(keys).toContain('config:app');
      expect(keys).toContain('temp:xyz');
    });

    it('should return all keys when empty filter is provided', async () => {
      const keys = await memoryStore.keys('');

      expect(keys).toHaveLength(5);
      expect(keys).toContain('user:123');
      expect(keys).toContain('user:456');
      expect(keys).toContain('session:abc');
      expect(keys).toContain('config:app');
      expect(keys).toContain('temp:xyz');
    });

    it('should filter keys using regex pattern', async () => {
      const userKeys = await memoryStore.keys('^user:');

      expect(userKeys).toHaveLength(2);
      expect(userKeys).toContain('user:123');
      expect(userKeys).toContain('user:456');
      expect(userKeys).not.toContain('session:abc');
    });

    it('should return empty array when no keys match pattern', async () => {
      const keys = await memoryStore.keys('^nonexistent:');

      expect(keys).toHaveLength(0);
    });

    it('should handle complex regex patterns', async () => {
      const keys = await memoryStore.keys('(user|session):');

      expect(keys).toHaveLength(3);
      expect(keys).toContain('user:123');
      expect(keys).toContain('user:456');
      expect(keys).toContain('session:abc');
      expect(keys).not.toContain('config:app');
      expect(keys).not.toContain('temp:xyz');
    });

    it('should handle invalid regex gracefully', async () => {
      const keys = await memoryStore.keys('[invalid regex');

      // Should return all keys when regex is invalid
      expect(keys).toHaveLength(5);
    });

    it('should work with case-sensitive patterns', async () => {
      await memoryStore.set('User:789', { name: 'Bob' });

      const lowerKeys = await memoryStore.keys('^user:');
      const upperKeys = await memoryStore.keys('^User:');

      expect(lowerKeys).toHaveLength(2); // user:123, user:456
      expect(upperKeys).toHaveLength(1); // User:789
    });

    it('should return keys in consistent order', async () => {
      const keys1 = await memoryStore.keys();
      const keys2 = await memoryStore.keys();

      expect(keys1).toEqual(keys2);
    });

    it('should work correctly after concurrent operations', async () => {
      const promises: Promise<void>[] = [];

      // Add more keys concurrently
      for (let i = 0; i < 10; i++) {
        promises.push(memoryStore.set(`concurrent:${i}`, { value: i }));
      }

      await Promise.all(promises);

      const allKeys = await memoryStore.keys();
      const concurrentKeys = await memoryStore.keys('^concurrent:');

      expect(allKeys.length).toBeGreaterThanOrEqual(15); // 5 initial + 10 new
      expect(concurrentKeys).toHaveLength(10);
    });
  });
});
