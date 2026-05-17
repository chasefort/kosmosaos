export function getFileEntryDecorations(args: {
    entryPath: string
    rootPath: string
    nodePathColorMap: Map<string, string>
    recentlyTouchedFiles: Record<string, number>
    now: number
    recentMs?: number
}): { nodeTypeDot?: string; recentlyTouched?: boolean } {
    const relPath = args.entryPath.startsWith(args.rootPath)
        ? args.entryPath.slice(args.rootPath.length).replace(/^\//, '')
        : args.entryPath

    return {
        nodeTypeDot: args.nodePathColorMap.get(relPath),
        recentlyTouched: Boolean(
            args.recentlyTouchedFiles[relPath]
            && (args.now - args.recentlyTouchedFiles[relPath]) < (args.recentMs ?? 60_000)
        ),
    }
}
