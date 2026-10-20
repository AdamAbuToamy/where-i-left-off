import {DatabaseSync} from 'node:sqlite'
import {readFileSync} from 'node:fs'
export function database(){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec(readFileSync(new URL('./schema.sql',import.meta.url),'utf8'))
 return {sqlite,prepare(sql){
  let values=[]
  const statement={bind(...args){values=args;return statement},async first(){return sqlite.prepare(sql).get(...values) || null},async all(){return {results:sqlite.prepare(sql).all(...values)}},async run(){const r=sqlite.prepare(sql).run(...values);return {meta:{changes:Number(r.changes)}}}}
  return statement
 }}
}
