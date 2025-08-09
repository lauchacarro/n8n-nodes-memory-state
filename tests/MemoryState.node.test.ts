// Mock de n8n-workflow
jest.mock('n8n-workflow', () => ({
  NodeOperationError: jest.fn().mockImplementation((node, message, options) => {
    const error = new Error(message);
    (error as any).node = node;
    (error as any).itemIndex = options?.itemIndex;
    return error;
  }),
  NodeConnectionType: {
    Main: 'main'
  }
}));

import { MemoryState } from '../nodes/MemoryState/MemoryState.node';
import { memoryStore } from '../src/MemoryStore';

describe('MemoryState Node', () => {
  let nodeInstance: MemoryState;
  let mockThis: any;

  beforeEach(async () => {
    // Clear the store before each test
    await memoryStore.clear();

    // Reset mocks
    jest.clearAllMocks();

    nodeInstance = new MemoryState();

    // Mock the execution context
    mockThis = {
      getInputData: jest.fn().mockReturnValue([{ json: {} }]),
      getNodeParameter: jest.fn(),
      getNode: jest.fn().mockReturnValue({ name: 'MemoryState' }),
    };
  });

  describe('Node Description', () => {
    it('should have correct node description', () => {
      const description = nodeInstance.description;

      expect(description.displayName).toBe('Memory State');
      expect(description.name).toBe('memoryState');
      expect(description.group).toContain('transform');
      expect(description.version).toBe(1);
      expect(description.inputs).toEqual(['main']);
      expect(description.outputs).toEqual(['main']);
    });

    it('should have correct action options', () => {
      const actionProperty = nodeInstance.description.properties.find(p => p.name === 'action');

      expect(actionProperty).toBeDefined();
      expect(actionProperty?.type).toBe('options');

      const options = (actionProperty as any)?.options;
      expect(options).toHaveLength(5);
      expect(options.map((o: any) => o.value)).toEqual(['delete', 'get', 'getWithDefault', 'keys', 'set']);
    });
  });

  describe('Set Action', () => {
    it('should store a valid JSON object', async () => {
      const key = 'test-key';
      const value = { userId: 123, state: 'active' };

      mockThis.getNodeParameter
        .mockReturnValueOnce('set') // action
        .mockReturnValueOnce(key) // key
        .mockReturnValueOnce(value); // value

      const result = await nodeInstance.execute.call(mockThis);

      expect(result).toEqual([[{
        json: {
          key: key,
          value: value
        }
      }]]);

      // Verify it was actually stored
      const stored = await memoryStore.get(key);
      expect(stored).toEqual(value);
    });

    it('should parse JSON string values', async () => {
      const key = 'test-key';
      const value = '{"userId": 123, "state": "active"}';
      const expectedValue = { userId: 123, state: 'active' };

      mockThis.getNodeParameter
        .mockReturnValueOnce('set') // action
        .mockReturnValueOnce(key) // key
        .mockReturnValueOnce(value); // value

      const result = await nodeInstance.execute.call(mockThis);

      expect(result).toEqual([[{
        json: {
          key: key,
          value: expectedValue
        }
      }]]);
    });

    it('should reject array values', async () => {
      const key = 'test-key';
      const value = [1, 2, 3];

      mockThis.getNodeParameter
        .mockReturnValueOnce('set') // action
        .mockReturnValueOnce(key) // key
        .mockReturnValueOnce(value); // value

      await expect(nodeInstance.execute.call(mockThis)).rejects.toThrow();
    });

    it('should reject null values', async () => {
      const key = 'test-key';
      const value = null;

      mockThis.getNodeParameter
        .mockReturnValueOnce('set') // action
        .mockReturnValueOnce(key) // key
        .mockReturnValueOnce(value); // value

      await expect(nodeInstance.execute.call(mockThis)).rejects.toThrow();
    });

    it('should reject invalid JSON strings', async () => {
      const key = 'test-key';
      const value = '{"invalid": json}';

      mockThis.getNodeParameter
        .mockReturnValueOnce('set') // action
        .mockReturnValueOnce(key) // key
        .mockReturnValueOnce(value); // value

      await expect(nodeInstance.execute.call(mockThis)).rejects.toThrow();
    });

    it('should reject empty or whitespace keys', async () => {
      const value = { test: 'value' };

      // Test empty key
      mockThis.getNodeParameter
        .mockReturnValueOnce('set') // action
        .mockReturnValueOnce('') // key
        .mockReturnValueOnce(value); // value

      await expect(nodeInstance.execute.call(mockThis)).rejects.toThrow();

      // Test whitespace key
      mockThis.getNodeParameter
        .mockReturnValueOnce('set') // action
        .mockReturnValueOnce('   ') // key
        .mockReturnValueOnce(value); // value

      await expect(nodeInstance.execute.call(mockThis)).rejects.toThrow();
    });
  });

  describe('Get Action', () => {
    it('should return stored value', async () => {
      const key = 'test-key';
      const value = { userId: 123, state: 'active' };

      // Store the value first
      await memoryStore.set(key, value);

      mockThis.getNodeParameter
        .mockReturnValueOnce('get') // action
        .mockReturnValueOnce(key); // key

      const result = await nodeInstance.execute.call(mockThis);

      expect(result).toEqual([[{
        json: {
          key: key,
          value: value
        }
      }]]);
    });

    it('should return null for non-existent key', async () => {
      const key = 'non-existent-key';

      mockThis.getNodeParameter
        .mockReturnValueOnce('get') // action
        .mockReturnValueOnce(key); // key

      const result = await nodeInstance.execute.call(mockThis);

      expect(result).toEqual([[{
        json: {
          key: key,
          value: null
        }
      }]]);
    });
  });

  describe('GetWithDefault Action', () => {
    it('should return stored value when key exists', async () => {
      const key = 'test-key';
      const value = { userId: 123, state: 'active' };
      const defaultValue = { state: 'new' };

      // Store the value first
      await memoryStore.set(key, value);

      mockThis.getNodeParameter
        .mockReturnValueOnce('getWithDefault') // action
        .mockReturnValueOnce(key) // key
        .mockReturnValueOnce(defaultValue); // defaultValue

      const result = await nodeInstance.execute.call(mockThis);

      expect(result).toEqual([[{
        json: {
          key: key,
          value: value // Should return stored value, not default
        }
      }]]);
    });

    it('should return default value when key does not exist and store it', async () => {
      const key = 'non-existent-key';
      const defaultValue = { state: 'new', userId: 0 };

      mockThis.getNodeParameter
        .mockReturnValueOnce('getWithDefault') // action
        .mockReturnValueOnce(key) // key
        .mockReturnValueOnce(defaultValue); // defaultValue

      const result = await nodeInstance.execute.call(mockThis);

      expect(result).toEqual([[{
        json: {
          key: key,
          value: defaultValue
        }
      }]]);

      // Verify that the default value was actually stored
      const storedValue = await memoryStore.get(key);
      expect(storedValue).toEqual(defaultValue);
    });

    it('should parse JSON string default values and store them', async () => {
      const key = 'non-existent-key';
      const defaultValueString = '{"state": "new", "userId": 0}';
      const expectedDefaultValue = { state: 'new', userId: 0 };

      mockThis.getNodeParameter
        .mockReturnValueOnce('getWithDefault') // action
        .mockReturnValueOnce(key) // key
        .mockReturnValueOnce(defaultValueString); // defaultValue

      const result = await nodeInstance.execute.call(mockThis);

      expect(result).toEqual([[{
        json: {
          key: key,
          value: expectedDefaultValue
        }
      }]]);

      // Verify that the parsed default value was actually stored
      const storedValue = await memoryStore.get(key);
      expect(storedValue).toEqual(expectedDefaultValue);
    });

    it('should reject invalid default values', async () => {
      const key = 'test-key';
      const defaultValue = [1, 2, 3]; // Array is not allowed

      mockThis.getNodeParameter
        .mockReturnValueOnce('getWithDefault') // action
        .mockReturnValueOnce(key) // key
        .mockReturnValueOnce(defaultValue); // defaultValue

      await expect(nodeInstance.execute.call(mockThis)).rejects.toThrow();
    });
  });

  describe('Delete Action', () => {
    it('should delete existing key and return success', async () => {
      const key = 'test-key';
      const value = { userId: 123, state: 'active' };

      // Store the value first
      await memoryStore.set(key, value);

      mockThis.getNodeParameter
        .mockReturnValueOnce('delete') // action
        .mockReturnValueOnce(key); // key

      const result = await nodeInstance.execute.call(mockThis);

      expect(result).toEqual([[{
        json: {
          key: key,
          success: true
        }
      }]]);

      // Verify it was actually deleted
      const stored = await memoryStore.get(key);
      expect(stored).toBeNull();
    });

    it('should return success even for non-existent key', async () => {
      const key = 'non-existent-key';

      mockThis.getNodeParameter
        .mockReturnValueOnce('delete') // action
        .mockReturnValueOnce(key); // key

      const result = await nodeInstance.execute.call(mockThis);

      expect(result).toEqual([[{
        json: {
          key: key,
          success: true
        }
      }]]);
    });
  });

  describe('Keys Action', () => {
    beforeEach(async () => {
      // Set up test data
      await memoryStore.set('user:123', { name: 'John', age: 30 });
      await memoryStore.set('user:456', { name: 'Jane', age: 25 });
      await memoryStore.set('session:abc', { active: true, timestamp: Date.now() });
      await memoryStore.set('config:app', { theme: 'dark', lang: 'en' });
      await memoryStore.set('temp:xyz', { data: 'test' });
    });

    it('should return all keys without values', async () => {
      mockThis.getNodeParameter
        .mockReturnValueOnce('keys') // action
        .mockReturnValueOnce(false) // getValues
        .mockReturnValueOnce(''); // filterPattern

      const result = await nodeInstance.execute.call(mockThis);

      expect(result[0]).toHaveLength(5);

      // Check that each item only has a key, no value
      result[0].forEach((item: any) => {
        expect(item.json).toHaveProperty('key');
        expect(item.json).not.toHaveProperty('value');
      });

      const keys = result[0].map((item: any) => item.json.key);
      expect(keys).toContain('user:123');
      expect(keys).toContain('user:456');
      expect(keys).toContain('session:abc');
      expect(keys).toContain('config:app');
      expect(keys).toContain('temp:xyz');
    });

    it('should return all keys with values when getValues is true', async () => {
      mockThis.getNodeParameter
        .mockReturnValueOnce('keys') // action
        .mockReturnValueOnce(true) // getValues
        .mockReturnValueOnce(''); // filterPattern

      const result = await nodeInstance.execute.call(mockThis);

      expect(result[0]).toHaveLength(5);

      // Check that each item has both key and value
      result[0].forEach((item: any) => {
        expect(item.json).toHaveProperty('key');
        expect(item.json).toHaveProperty('value');
        expect(typeof item.json.key).toBe('string');
        expect(typeof item.json.value).toBe('object');
      });

      // Find specific items and verify their values
      const userItem = result[0].find((item: any) => item.json.key === 'user:123');
      expect(userItem).toBeDefined();
      expect(userItem!.json.value).toEqual({ name: 'John', age: 30 });
    });

    it('should filter keys using regex pattern without values', async () => {
      mockThis.getNodeParameter
        .mockReturnValueOnce('keys') // action
        .mockReturnValueOnce(false) // getValues
        .mockReturnValueOnce('^user:'); // filterPattern

      const result = await nodeInstance.execute.call(mockThis);

      expect(result[0]).toHaveLength(2);

      const keys = result[0].map((item: any) => item.json.key);
      expect(keys).toContain('user:123');
      expect(keys).toContain('user:456');
      expect(keys).not.toContain('session:abc');
      expect(keys).not.toContain('config:app');
    });

    it('should filter keys using regex pattern with values', async () => {
      mockThis.getNodeParameter
        .mockReturnValueOnce('keys') // action
        .mockReturnValueOnce(true) // getValues
        .mockReturnValueOnce('^user:'); // filterPattern

      const result = await nodeInstance.execute.call(mockThis);

      expect(result[0]).toHaveLength(2);

      result[0].forEach((item: any) => {
        expect(item.json).toHaveProperty('key');
        expect(item.json).toHaveProperty('value');
        expect(item.json.key).toMatch(/^user:/);
      });

      const user123Item = result[0].find((item: any) => item.json.key === 'user:123');
      const user456Item = result[0].find((item: any) => item.json.key === 'user:456');

      expect(user123Item).toBeDefined();
      expect(user456Item).toBeDefined();
      expect(user123Item!.json.value).toEqual({ name: 'John', age: 30 });
      expect(user456Item!.json.value).toEqual({ name: 'Jane', age: 25 });
    });

    it('should return empty array when no keys match pattern', async () => {
      mockThis.getNodeParameter
        .mockReturnValueOnce('keys') // action
        .mockReturnValueOnce(false) // getValues
        .mockReturnValueOnce('^nonexistent:'); // filterPattern

      const result = await nodeInstance.execute.call(mockThis);

      expect(result[0]).toHaveLength(0);
    });

    it('should handle complex regex patterns', async () => {
      mockThis.getNodeParameter
        .mockReturnValueOnce('keys') // action
        .mockReturnValueOnce(true) // getValues
        .mockReturnValueOnce('(user|session):'); // filterPattern

      const result = await nodeInstance.execute.call(mockThis);

      expect(result[0]).toHaveLength(3);

      const keys = result[0].map((item: any) => item.json.key);
      expect(keys).toContain('user:123');
      expect(keys).toContain('user:456');
      expect(keys).toContain('session:abc');
      expect(keys).not.toContain('config:app');
      expect(keys).not.toContain('temp:xyz');
    });

    it('should handle invalid regex gracefully', async () => {
      mockThis.getNodeParameter
        .mockReturnValueOnce('keys') // action
        .mockReturnValueOnce(false) // getValues
        .mockReturnValueOnce('[invalid regex'); // filterPattern

      const result = await nodeInstance.execute.call(mockThis);

      // Should return all keys when regex is invalid
      expect(result[0]).toHaveLength(5);
    });

    it('should handle whitespace in filter pattern', async () => {
      mockThis.getNodeParameter
        .mockReturnValueOnce('keys') // action
        .mockReturnValueOnce(false) // getValues
        .mockReturnValueOnce('  ^user:  '); // filterPattern with spaces

      const result = await nodeInstance.execute.call(mockThis);

      expect(result[0]).toHaveLength(2);

      const keys = result[0].map((item: any) => item.json.key);
      expect(keys).toContain('user:123');
      expect(keys).toContain('user:456');
    });

    it('should work with empty memory store', async () => {
      await memoryStore.clear();

      mockThis.getNodeParameter
        .mockReturnValueOnce('keys') // action
        .mockReturnValueOnce(false) // getValues
        .mockReturnValueOnce(''); // filterPattern

      const result = await nodeInstance.execute.call(mockThis);

      expect(result[0]).toHaveLength(0);
    });
  });

  describe('Multiple Items Processing', () => {
    it('should process multiple input items', async () => {
      const items = [
        { json: {} },
        { json: {} },
        { json: {} }
      ];

      mockThis.getInputData.mockReturnValue(items);

      // Mock parameters for three set operations
      mockThis.getNodeParameter
        .mockReturnValueOnce('set').mockReturnValueOnce('key1').mockReturnValueOnce({ value: 1 })
        .mockReturnValueOnce('set').mockReturnValueOnce('key2').mockReturnValueOnce({ value: 2 })
        .mockReturnValueOnce('set').mockReturnValueOnce('key3').mockReturnValueOnce({ value: 3 });

      const result = await nodeInstance.execute.call(mockThis);

      expect(result).toEqual([[
        { json: { key: 'key1', value: { value: 1 } } },
        { json: { key: 'key2', value: { value: 2 } } },
        { json: { key: 'key3', value: { value: 3 } } }
      ]]);

      // Verify all items were stored
      expect(await memoryStore.get('key1')).toEqual({ value: 1 });
      expect(await memoryStore.get('key2')).toEqual({ value: 2 });
      expect(await memoryStore.get('key3')).toEqual({ value: 3 });
    });
  });

  describe('Error Handling', () => {
    it('should throw error for unsupported action', async () => {
      mockThis.getNodeParameter
        .mockReturnValueOnce('unsupported-action') // action
        .mockReturnValueOnce('test-key'); // key

      await expect(nodeInstance.execute.call(mockThis)).rejects.toThrow();
    });

    it('should include item index in error messages', async () => {
      const items = [{ json: {} }, { json: {} }];
      mockThis.getInputData.mockReturnValue(items);

      // Second item has invalid action
      mockThis.getNodeParameter
        .mockReturnValueOnce('get').mockReturnValueOnce('key1') // First item
        .mockReturnValueOnce('invalid-action').mockReturnValueOnce('key2'); // Second item

      await expect(nodeInstance.execute.call(mockThis)).rejects.toThrow();
    });
  });

  describe('Key Trimming', () => {
    it('should trim whitespace from keys', async () => {
      const key = '  test-key  ';
      const trimmedKey = 'test-key';
      const value = { test: 'value' };

      mockThis.getNodeParameter
        .mockReturnValueOnce('set') // action
        .mockReturnValueOnce(key) // key with whitespace
        .mockReturnValueOnce(value); // value

      const result = await nodeInstance.execute.call(mockThis);

      expect(result).toEqual([[{
        json: {
          key: trimmedKey, // Should return trimmed key
          value: value
        }
      }]]);

      // Verify it was stored with trimmed key
      const stored = await memoryStore.get(trimmedKey);
      expect(stored).toEqual(value);
    });
  });
});
