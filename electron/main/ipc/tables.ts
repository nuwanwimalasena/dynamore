import { IpcMain } from 'electron'
import {
    DynamoDBClient,
    ListTablesCommand,
    DescribeTableCommand,
    CreateTableCommand,
    DeleteTableCommand,
    CreateTableCommandInput
} from '@aws-sdk/client-dynamodb'
import { getCredentials } from './auth'

function getClient() {
    const creds = getCredentials()
    return new DynamoDBClient({
        region: creds.region,
        credentials: {
            accessKeyId: creds.accessKeyId,
            secretAccessKey: creds.secretAccessKey,
            sessionToken: creds.sessionToken
        }
    })
}

export function registerTableHandlers(ipcMain: IpcMain): void {
    ipcMain.handle('tables:list', async () => {
        try {
            const client = getClient()
            const tableNames: string[] = []
            let lastEvaluatedTableName: string | undefined

            do {
                const res = await client.send(new ListTablesCommand({
                    ExclusiveStartTableName: lastEvaluatedTableName
                }))
                tableNames.push(...(res.TableNames ?? []))
                lastEvaluatedTableName = res.LastEvaluatedTableName
            } while (lastEvaluatedTableName)

            return { success: true, tableNames }
        } catch (err: unknown) {
            const error = err as Error
            return { success: false, error: error.message }
        }
    })

    ipcMain.handle('tables:describe', async (_, tableName: string) => {
        try {
            const client = getClient()
            const res = await client.send(new DescribeTableCommand({ TableName: tableName }))
            return { success: true, table: res.Table }
        } catch (err: unknown) {
            const error = err as Error
            return { success: false, error: error.message }
        }
    })

    ipcMain.handle('tables:create', async (_, params: CreateTableCommandInput) => {
        try {
            const client = getClient()
            const res = await client.send(new CreateTableCommand(params))
            return { success: true, table: res.TableDescription }
        } catch (err: unknown) {
            const error = err as Error
            return { success: false, error: error.message }
        }
    })

    ipcMain.handle('tables:delete', async (_, tableName: string) => {
        try {
            const client = getClient()
            await client.send(new DeleteTableCommand({ TableName: tableName }))
            return { success: true }
        } catch (err: unknown) {
            const error = err as Error
            return { success: false, error: error.message }
        }
    })
}
