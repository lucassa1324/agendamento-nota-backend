import { GetDomainConfigurationResponse, GetDomainResponse } from "./types";

export class ConfigVerificationParser {
  parse(domain: GetDomainResponse, configuration: GetDomainConfigurationResponse) {
    return { verification: [
      ...(domain.verification ? domain.verification : []),
      ...(configuration.recommendedIPv4.length > 0 ? [{
        type: 'A',
        domain: '@',
        value: configuration.recommendedIPv4[0].value[0]
      }] : []),
      ...(configuration.recommendedCNAME.length > 0 ? [{
        type: 'CNAME',
        domain: domain.name.replace(domain.apexName, '').replace('.', '') || '@',
        value: configuration.recommendedCNAME[0].value
      }] : [])
    ], verified: domain.verified && configuration.misconfigured === 'false' }
  }
}