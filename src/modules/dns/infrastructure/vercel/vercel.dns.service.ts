import axios from "axios";
import { environment } from "../../../infrastructure/environment/environment";
import { 
  CreateDomainRequest,
  GetDomainConfigurationResponse,
  GetDomainResponse,
  GetDomainsResponse,
  VercelParams
} from "./types";
import { ConfigVerificationParser } from "./dns.parser";


export class VercelDnsService {
  private api = axios.create({
    baseURL: 'https://api.vercel.com',
    headers: {
    'Authorization': `Bearer ${environment.vercel.accessToken}`,
    'Content-Type': 'application/json',
    },
  })

  async getDomain(domain: string) {
    const remoteDomain = await this.getDomainInformation(domain);
    const remoteDonfig = await this.getDomainConfiguration(domain);

    return new ConfigVerificationParser().parse(remoteDomain, remoteDonfig)
  }

  private async getDomainInformation(domain: string, params?: VercelParams) {
    const req = await this.api.get<GetDomainResponse>(`/v9/projects/${environment.vercel.projectId}/domains/${domain}`, { params });

    return req.data
  }

  private async getDomainConfiguration(domain: string, params?: VercelParams) {
    const req = await this.api.get<GetDomainConfigurationResponse>(`/v6/domains/{domain}/config`, { params });

    return req.data
  }

  async getDomains(params?: VercelParams) {
    const req = await this.api.get<GetDomainsResponse>(`/v9/projects/${environment.vercel.projectId}/domains`, { params });
    
    return req.data
  }

  async createDomain(body: CreateDomainRequest) {
    const req = await this.api.post<GetDomainResponse>(`/v10/projects/${environment.vercel.projectId}/domains`, body);
    const remoteConfig = await this.getDomainConfiguration(body.name);

    return new ConfigVerificationParser().parse(req.data, remoteConfig)
  }

  async verifyDomain(domain: string) {
    const req = await this.api.post<GetDomainsResponse>(`/v9/projects/${environment.vercel.projectId}/domains/${domain}/verify`);
    
    return req.data
  }

  async removeDomain(domain: string) {
    const req = await this.api.delete<GetDomainsResponse>(`/v9/projects/${environment.vercel.projectId}/domains/${domain}`);

    return req.data
  }
}