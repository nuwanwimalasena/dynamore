export type ScalarType = 'S' | 'N' | 'B'

export interface KeyDefinition {
    name: string
    attributeType: ScalarType
}

export type BillingMode = 'PAY_PER_REQUEST' | 'PROVISIONED'

export interface ProvisionedCapacity {
    readCapacityUnits: number
    writeCapacityUnits: number
}

export interface GsiDefinition {
    indexName: string
    partitionKey: KeyDefinition
    sortKey?: KeyDefinition
    projectionType: 'ALL' | 'KEYS_ONLY' | 'INCLUDE'
    nonKeyAttributes?: string[]
    provisionedThroughput?: ProvisionedCapacity
}

export interface LsiDefinition {
    indexName: string
    sortKey: KeyDefinition
    projectionType: 'ALL' | 'KEYS_ONLY' | 'INCLUDE'
    nonKeyAttributes?: string[]
}

export interface CreateTableRequest {
    tableName: string
    partitionKey: KeyDefinition
    sortKey?: KeyDefinition
    billingMode: BillingMode
    provisionedThroughput?: ProvisionedCapacity
    globalSecondaryIndexes?: GsiDefinition[]
    localSecondaryIndexes?: LsiDefinition[]
}

export interface KeySchemaItemDto {
    attributeName: string
    keyType: string
}

export interface AttributeDefinitionDto {
    attributeName: string
    attributeType: string
}

export interface ProjectionDto {
    projectionType?: string
    nonKeyAttributes?: string[]
}

export interface GsiDescriptionDto {
    indexName?: string
    indexStatus?: string
    keySchema: KeySchemaItemDto[]
    projection?: ProjectionDto
    provisionedThroughput?: ProvisionedCapacity
}

export interface LsiDescriptionDto {
    indexName?: string
    keySchema: KeySchemaItemDto[]
    projection?: ProjectionDto
}

export interface BillingModeSummaryDto {
    billingMode: string
}

export interface TableDescriptionDto {
    tableName?: string
    tableStatus?: string
    itemCount?: number
    tableSizeBytes?: number
    creationDateTime?: string
    keySchema: KeySchemaItemDto[]
    attributeDefinitions: AttributeDefinitionDto[]
    billingModeSummary?: BillingModeSummaryDto
    provisionedThroughput?: ProvisionedCapacity
    globalSecondaryIndexes: GsiDescriptionDto[]
    localSecondaryIndexes: LsiDescriptionDto[]
}

export interface TableListResponse {
    success: boolean
    tableNames: string[]
}

export interface TableDescribeResponse {
    success: boolean
    table?: TableDescriptionDto
}

export interface TableCreateResponse {
    success: boolean
    table?: TableDescriptionDto
}

export interface TableDeleteResponse {
    success: boolean
}

// Items
export interface PutItemRequest {
    tableName: string
    item: Record<string, unknown>
}

export interface GetItemRequest {
    tableName: string
    key: Record<string, unknown>
}

export interface UpdateItemRequest {
    tableName: string
    key: Record<string, unknown>
    updateExpression?: string
    expressionAttributeNames?: Record<string, string>
    expressionAttributeValues?: Record<string, unknown>
}

export interface DeleteItemRequest {
    tableName: string
    key: Record<string, unknown>
}

export interface BatchDeleteItemsRequest {
    tableName: string
    keys: Record<string, unknown>[]
}

export interface ItemResponse {
    success: boolean
    item?: Record<string, unknown>
}

export interface MutationResponse {
    success: boolean
}

// Query & Scan
export interface QueryRequest {
    tableName: string
    keyConditionExpression: string
    indexName?: string
    filterExpression?: string
    projectionExpression?: string
    expressionAttributeNames?: Record<string, string>
    expressionAttributeValues?: Record<string, unknown>
    limit?: number
    exclusiveStartKey?: Record<string, unknown>
    scanIndexForward?: boolean
}

export interface ScanRequest {
    tableName: string
    indexName?: string
    filterExpression?: string
    projectionExpression?: string
    expressionAttributeNames?: Record<string, string>
    expressionAttributeValues?: Record<string, unknown>
    limit?: number
    exclusiveStartKey?: Record<string, unknown>
}

export interface QueryResultDto {
    items: Record<string, unknown>[]
    count: number
    scannedCount: number
    lastEvaluatedKey?: Record<string, unknown>
}
