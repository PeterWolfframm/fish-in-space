// The slice of the PocketBase JS SDK the game uses.
type Rec = { id: string; [k: string]: unknown };
interface ListOpts {
  filter?: string;
  sort?: string;
  fields?: string;
  batch?: number;
}
export default class PocketBase {
  constructor(baseUrl?: string);
  baseURL: string;
  autoCancellation(v: boolean): void;
  authStore: { isValid: boolean; record: { id: string; email?: string; name?: string; guest?: boolean; [k: string]: unknown } | null; clear(): void };
  collection(name: string): {
    authWithPassword(email: string, password: string): Promise<unknown>;
    authRefresh(): Promise<unknown>;
    getList(page: number, perPage: number, opts?: ListOpts): Promise<{ items: Rec[] }>;
    getFullList(opts?: ListOpts): Promise<Rec[]>;
    getFirstListItem(filter: string, opts?: ListOpts): Promise<Rec>;
    getOne(id: string, opts?: ListOpts): Promise<Rec>;
    create(body: Record<string, unknown>): Promise<Rec>;
    update(id: string, body: Record<string, unknown>): Promise<Rec>;
    delete(id: string): Promise<boolean>;
  };
  filter(template: string, params: Record<string, unknown>): string;
}
