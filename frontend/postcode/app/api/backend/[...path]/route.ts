import { proxyApiRequest } from "@/lib/api/proxy";
type Context = { params: Promise<{ path: string[] }> };
async function handle(request: Request, context: Context) {
  const { path } = await context.params;
  return proxyApiRequest(request, path);
}
export { handle as GET, handle as POST, handle as PUT, handle as DELETE };
