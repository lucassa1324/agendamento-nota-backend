import { 
  Staff, 
  ValidateEmailResult 
} from "../entities/staff.entity";

export interface IStaffRepository {
  existsByEmail(email: string): Promise<boolean>;
  
  existsByEmailAndCompany(email: string, companyId: string): Promise<boolean>;
  
  existsByEmailInOtherCompany(
    email: string,
    companyId: string,
    excludeStaffId?: string,
  ): Promise<boolean>;
  
  findByEmailAndCompany(email: string, companyId: string): Promise<Staff | null>;
  
  findByEmail(email: string): Promise<Staff | null>;
  
  findByEmailAnyCompany(
    email: string,
    excludeStaffId?: string,
  ): Promise<Staff[]>;

  findById(id: string): Promise<Staff | null>;
  
  findByCompany(companyId: string): Promise<Staff[]>;
}
