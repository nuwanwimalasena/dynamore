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
    expressionAttributeNames?: Record<string, string>
    expressionAttributeValues?: Record<string, unknown>
    limit?: number
    exclusiveStartKey?: Record<string, unknown>
}

export function registerQueryHandlers(ipcMain: IpcMain): void {
    ipcMain.handle('query:query', async (_, params: QueryParams) => {
        try {
            const docClient = getDocClient()
            const res = await docClient.send(new QueryCommand({
                TableName: params.tableName,
                IndexName: params.indexName,
                KeyConditionExpression: params.keyConditionExpression,
                FilterExpression: params.filterExpression,
                ExpressionAttributeNames: params.expressionAttributeNames,
                ExpressionAttributeValues: params.expressionAttributeValues,
                Limit: params.limit,
                ExclusiveStartKey: params.exclusiveStartKey,
                ScanIndexForward: params.scanIndexForward ?? true
            }))
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
            const res = await docClient.send(new ScanCommand({
                TableName: params.tableName,
                IndexName: params.indexName,
                FilterExpression: params.filterExpression,
                ExpressionAttributeNames: params.expressionAttributeNames,
                ExpressionAttributeValues: params.expressionAttributeValues,
                Limit: params.limit,
                ExclusiveStartKey: params.exclusiveStartKey
            }))
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
