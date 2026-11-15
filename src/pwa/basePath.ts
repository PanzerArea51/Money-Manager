/** 'Money-Manager', '/Money-Manager', 'Money-Manager/', '/Money-Manager/' -> '/Money-Manager/' */
export function toBasePath(repoName: string): string {
  const name = repoName.replace(/^\/+/, '').replace(/\/+$/, '');
  return `/${name}/`;
}
