import Elysia from "elysia";
import { VercelDnsService } from "./vercel/vercel.dns.service";
import { DnsRepository } from "../infrastructure/adapters/out/dns.repository";

const dnsService = new VercelDnsService();
const dnsRepository = new DnsRepository();

export const dnsPlugin = new Elysia().decorate('dnsService', dnsService).decorate('dnsRepository', dnsRepository);