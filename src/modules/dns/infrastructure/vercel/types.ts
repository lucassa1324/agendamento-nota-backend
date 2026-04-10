export interface VercelParams {
  projectIdOrName?: string;
  strict?: boolean;
  teamId?: string;
  slug?: string;
  limit?: number;
  since?: number;
  until?: number;
}

export type GetDomainResponse = {
    suffix: string
    verified: boolean
    nameservers: Array<string>
    intendedNameservers: Array<string>
    customNameservers: Array<string>
    creator: {
      username: string
      email: string
      customerId: string
      isDomainReseller: boolean
      id: string
    }
    name: string
    apexName: string
    teamId: string
    boughtAt: number
    createdAt: number
    expiresAt: number
    id: string
    renew: boolean
    serviceType: string
    transferredAt: number
    transferStartedAt: number
    userId: string
    verification?: Array<{
      type: string
      domain: string
      value: string
      reason: string
    }>
    error?: {
      code: string
      message: string
    }
}


export type GetDomainsResponse = {
  domains: Array<{
    verified: string
    nameservers: Array<any>
    intendedNameservers: Array<any>
    customNameservers: Array<any>
    creator: {
      username: string
      email: string
      customerId: string
      isDomainReseller: string
      id: string
    }
    name: string
    teamId: string
    boughtAt: string
    createdAt: string
    expiresAt: string
    id: string
    renew: string
    serviceType: string
    transferredAt: string
    transferStartedAt: string
    userId: string
  }>
  pagination: {
    count: string
    next: string
    prev: string
  }
}

export type CreateDomainRequest = {
  name: string
  customEnvironmentId?: string
  gitBranch?: string
  redirect?: string
  redirectStatusCode?: string
}

export type GetDomainConfigurationResponse = {
  configuredBy: string
  acceptedChallenges: Array<any>
  recommendedIPv4: Array<{
    rank: string
    value: Array<any>
  }>
  recommendedCNAME: Array<{
    rank: string
    value: string
  }>
  misconfigured: string
}
