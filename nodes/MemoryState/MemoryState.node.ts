import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
	NodeConnectionType,
	ApplicationError,
} from 'n8n-workflow';

import { memoryStore } from '../../src/MemoryStore';

export class MemoryState implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Memory State',
		name: 'memoryState',
		icon: 'file:memorystate.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["action"] + ": " + $parameter["key"]}}',
		description: 'Store and retrieve key-value pairs in memory state',
		defaults: {
			name: 'Memory State',
		},
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		properties: [
			{
				displayName: 'Action',
				name: 'action',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Delete',
						value: 'delete',
						description: 'Delete a key from memory',
						action: 'Delete a key',
					},
					{
						name: 'Get',
						value: 'get',
						description: 'Retrieve a value by key',
						action: 'Get a value',
					},
					{
						name: 'Get with Default',
						value: 'getWithDefault',
						description: 'Retrieve a value by key or return default if not found',
						action: 'Get a value with default',
					},
					{
						name: 'Keys',
						value: 'keys',
						description: 'List all keys in memory with optional filtering',
						action: 'List keys',
					},
					{
						name: 'Set',
						value: 'set',
						description: 'Store a value for a key',
						action: 'Set a value',
					},
				],
				default: 'get',
			},
			{
				displayName: 'Key',
				name: 'key',
				type: 'string',
				default: '',
				placeholder: 'session:123',
				description: 'The key to store/retrieve/delete',
				required: true,
			},
			{
				displayName: 'Value',
				name: 'value',
				type: 'json',
				default: '{}',
				placeholder: '{"userId": 123, "state": "active"}',
				description: 'The JSON object to store (must be an object, not array or primitive)',
				displayOptions: {
					show: {
						action: ['set'],
					},
				},
				required: true,
			},
			{
				displayName: 'Default Value',
				name: 'defaultValue',
				type: 'json',
				default: '{}',
				placeholder: '{"state": "new"}',
				description: 'The default JSON object to return if key is not found',
				displayOptions: {
					show: {
						action: ['getWithDefault'],
					},
				},
				required: true,
			},
			{
				displayName: 'Get Values',
				name: 'getValues',
				type: 'boolean',
				default: false,
				description: 'Whether to get the value of matching keys',
				displayOptions: {
					show: {
						action: ['keys'],
					},
				},
			},
			{
				displayName: 'Filter Pattern (RegEx)',
				name: 'filterPattern',
				type: 'string',
				default: '',
				placeholder: '^user:.*',
				description: 'Optional regular expression pattern to filter keys. Leave empty to get all keys.',
				displayOptions: {
					show: {
						action: ['keys'],
					},
				},
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const action = this.getNodeParameter('action', i) as string;

				// Keys operation doesn't need a key parameter
				if (action === 'keys') {
					const getValues = this.getNodeParameter('getValues', i, false) as boolean;
					const filterPattern = this.getNodeParameter('filterPattern', i, '') as string;

					try {
						const keys = await memoryStore.keys(filterPattern.trim());

						if (getValues) {
							// Get values for each key and create separate items
							for (const key of keys) {
								const value = await memoryStore.get(key);
								returnData.push({
									json: {
										key: key,
										value: value,
									},
								});
							}
						} else {
							// Return only keys as separate items
							for (const key of keys) {
								returnData.push({
									json: {
										key: key,
									},
								});
							}
						}
					} catch (error) {
						throw new ApplicationError(
							`Error listing keys: ${error instanceof Error ? error.message : 'Unknown error'}`,
						);
					}
					continue;
				}

				// For all other operations, key is required
				const key = this.getNodeParameter('key', i) as string;

				if (!key || key.trim() === '') {
					throw new NodeOperationError(this.getNode(), 'Key is required and cannot be empty', {
						itemIndex: i,
					});
				}

				const trimmedKey = key.trim();

				switch (action) {
					case 'set': {
						const rawValue = this.getNodeParameter('value', i);
						let parsedValue: Record<string, any>;

						// Parse and validate the value
						try {
							if (typeof rawValue === 'string') {
								parsedValue = JSON.parse(rawValue);
							} else {
								parsedValue = rawValue as Record<string, any>;
							}

							// Validate that it's an object (not array, not null, not primitive)
							if (typeof parsedValue !== 'object' || parsedValue === null || Array.isArray(parsedValue)) {
								throw new ApplicationError('Value must be a JSON object');
							}
						} catch (error) {
							throw new ApplicationError(
								`Invalid JSON value: ${error instanceof Error ? error.message : 'Unknown error'}. Value must be a JSON object (not array, not primitive, not null)`,
							);
						}

						await memoryStore.set(trimmedKey, parsedValue);

						returnData.push({
							json: {
								key: trimmedKey,
								value: parsedValue,
							},
						});
						break;
					}

					case 'get': {
						const value = await memoryStore.get(trimmedKey);

						returnData.push({
							json: {
								key: trimmedKey,
								value: value,
							},
						});
						break;
					}

					case 'getWithDefault': {
						const rawDefaultValue = this.getNodeParameter('defaultValue', i);
						let parsedDefaultValue: Record<string, any>;

						// Parse and validate the default value
						try {
							if (typeof rawDefaultValue === 'string') {
								parsedDefaultValue = JSON.parse(rawDefaultValue);
							} else {
								parsedDefaultValue = rawDefaultValue as Record<string, any>;
							}

							// Validate that it's an object (not array, not null, not primitive)
							if (typeof parsedDefaultValue !== 'object' || parsedDefaultValue === null || Array.isArray(parsedDefaultValue)) {
								throw new ApplicationError('Default value must be a JSON object');
							}
						} catch (error) {
							throw new ApplicationError(
								`Invalid JSON default value: ${error instanceof Error ? error.message : 'Unknown error'}. Default value must be a JSON object (not array, not primitive, not null)`,
							);
						}

						let value = await memoryStore.get(trimmedKey);

						// If key doesn't exist, set the default value and use it
						if (value === null) {
							await memoryStore.set(trimmedKey, parsedDefaultValue);
							value = parsedDefaultValue;
						}

						returnData.push({
							json: {
								key: trimmedKey,
								value: value,
							},
						});
						break;
					}

					case 'delete': {
						await memoryStore.delete(trimmedKey);

						returnData.push({
							json: {
								key: trimmedKey,
								success: true,
							},
						});
						break;
					}

					default: {
						throw new NodeOperationError(this.getNode(), `Unsupported action '${action}'`, {
							itemIndex: i,
						});
					}
				}
			} catch (error) {
				// If it's already a NodeOperationError, re-throw it
				if (error instanceof NodeOperationError) {
					throw error;
				}

				// Wrap other errors in NodeOperationError
				throw new NodeOperationError(
					this.getNode(),
					`Error executing Memory State operation: ${error instanceof Error ? error.message : 'Unknown error'}`,
					{ itemIndex: i },
				);
			}
		}

		return [returnData];
	}
}
