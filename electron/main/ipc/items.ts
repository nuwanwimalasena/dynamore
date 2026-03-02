import { IpcMain } from 'electron'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
    DynamoDBDocumentClient,
    PutCommand,
    GetCommand,
    UpdateCommand,
    DeleteCommand,
    BatchWriteCommand
} from '@aws-sdk/lib-dynamodb'
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
    return DynamoDBDocumentClient.from(client, {
        marshallOptions: { removeUndefinedValues: true }
    })
}

export function registerItemHandlers(ipcMain: IpcMain): void {
    ipcMain.handle('items:put', async (_, { tableName, item }) => {
        try {
            const docClient = getDocClient()
            await docClient.send(new PutCommand({ TableName: tableName, Item: item }))
            return { success: true }
        } catch (err: unknown) {
            const error = err as Error
            return { success: false, error: error.message }
        }
    })

    ipcMain.handle('items:get', async (_, { tableName, key }) => {
        try {
            const docClient = getDocClient()
            const res = await docClient.send(new GetCommand({ TableName: tableName, Key: key }))
            return { success: true, item: res.Item }
        } catch (err: unknown) {
            const error = err as Error
            return { success: false, error: error.message }
        }
    })

    ipcMain.handle('items:update', async (_, params) => {
        try {
            const docClient = getDocClient()
            const res = await docClient.send(new UpdateCommand(params))
            return { success: true, attributes: res.Attributes }
        } catch (err: unknown) {
            const error = err as Error
            return { success: false, error: error.message }
        }
    })

    ipcMain.handle('items:delete', async (_, { tableName, key }) => {
        try {
            const docClient = getDocClient()
            await docClient.send(new DeleteCommand({ TableName: tableName, Key: key }))
            return { success: true }
        } catch (err: unknown) {
            const error = err as Error
            return { success: false, error: error.message }
        }
    })

    ipcMain.handle('items:batchDelete', async (_, { tableName, keys }) => {
        try {
            const docClient = getDocClient()
            // BatchWrite supports max 25 items per call
            const chunks: typeof keys[] = []
            for (let i = 0; i < keys.length; i += 25) {
                chunks.push(keys.slice(i, i + 25))
            }
            for (const chunk of chunks) {
                await docClient.send(new BatchWriteCommand({
                    RequestItems: {
                        [tableName]: chunk.map((key: Record<string, unknown>) => ({ DeleteRequest: { Key: key } }))
                    }
                }))
            }
            return { success: true, deletedCount: keys.length }
        } catch (err: unknown) {
            const error = err as Error
            return { success: false, error: error.message }
        }
    })
}
