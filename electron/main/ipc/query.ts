import { IpcMain } from 'electron'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb'
import { getCredentials } from './auth'

function getDocClient() {
    const creds = getCredentials()
    const client = new DynamoDBClient({
        region: creds.region,
        credentials: {
            accessKeyId: creds.accessKeyId,
            secretAccessKey: creds.secretAccessKey,
            sessionToken: creds.sessionToken
        }
    })
    return DynamoDBDocumentClient.from(client)
}

export interface QueryParams {
    tableName: string
    indexName?: string
    keyConditionExpression: string
    filterExpression?: string
    projectionExpression?: string
    expressionAttributeNames?: Record<string, string>
    expressionAttributeValues?: Record<string, unknown>
    limit?: number
    exclusiveStartKey?: Record<string, unknown>
    scanIndexForward?: boolean
}

export interface ScanParams {
    tableName: string
    indexName?: string
    filterExpression?: string
    projectionExpression?: string
    expressionAttributeNames?: Record<string, string>
    expressionAttributeValues?: Record<string, unknown>
    limit?: number
    exclusiveStartKey?: Record<string, unknown>
}

export function registerQueryHandlers(ipcMain: IpcMain): void {
    ipcMain.handle('query:query', async (_, params: QueryParams) => {
        try {
            const docClient = getDocClient()
            
            const input: any = {
                TableName: params.tableName,
                KeyConditionExpression: params.keyConditionExpression,
            }
            
            if (params.indexName) input.IndexName = params.indexName
            if (params.filterExpression) input.FilterExpression = params.filterExpression
            if (params.projectionExpression) input.ProjectionExpression = params.projectionExpression
            if (params.expressionAttributeNames && Object.keys(params.expressionAttributeNames).length > 0) {
                input.ExpressionAttributeNames = params.expressionAttributeNames
            }
            if (params.expressionAttributeValues && Object.keys(params.expressionAttributeValues).length > 0) {
                input.ExpressionAttributeValues = params.expressionAttributeValues
            }
            if (params.limit !== undefined && params.limit !== null) input.Limit = params.limit
            if (params.exclusiveStartKey) input.ExclusiveStartKey = params.exclusiveStartKey
            if (params.scanIndexForward !== undefined) input.ScanIndexForward = params.scanIndexForward

            const res = await docClient.send(new QueryCommand(input))
            return {
                success: true,
                items: res.Items ?? [],
                count: res.Count,
                scannedCount: res.ScannedCount,
                lastEvaluatedKey: res.LastEvaluatedKey
            }
        } catch (err: unknown) {
            const error = err as Error
            return { success: false, error: error.message }
        }
    })

    ipcMain.handle('query:scan', async (_, params: ScanParams) => {
        try {
            const docClient = getDocClient()
            
            const input: any = {
                TableName: params.tableName,
            }
            
            if (params.indexName) input.IndexName = params.indexName
            if (params.filterExpression) input.FilterExpression = params.filterExpression
            if (params.projectionExpression) input.ProjectionExpression = params.projectionExpression
            if (params.expressionAttributeNames && Object.keys(params.expressionAttributeNames).length > 0) {
                input.ExpressionAttributeNames = params.expressionAttributeNames
            }
            if (params.expressionAttributeValues && Object.keys(params.expressionAttributeValues).length > 0) {
                input.ExpressionAttributeValues = params.expressionAttributeValues
            }
            if (params.limit !== undefined && params.limit !== null) input.Limit = params.limit
            if (params.exclusiveStartKey) input.ExclusiveStartKey = params.exclusiveStartKey

            const res = await docClient.send(new ScanCommand(input))
            return {
                success: true,
                items: res.Items ?? [],
                count: res.Count,
                scannedCount: res.ScannedCount,
                lastEvaluatedKey: res.LastEvaluatedKey
            }
        } catch (err: unknown) {
            const error = err as Error
            return { success: false, error: error.message }
        }
    })
}
