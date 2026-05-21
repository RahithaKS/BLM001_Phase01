import { type User, type InsertUser, type Chat, type InsertChat, type Message, type InsertMessage, type Document, type InsertDocument, type Board, type InsertBoard, type BoardTemplate, type InsertBoardTemplate, type BoardThread, type InsertBoardThread, type BoardDocument, type InsertBoardDocument, type BoardDataSource, type InsertBoardDataSource, type InsertQueryAudit, type QueryAudit, type Company, type InsertCompany, type CompanyMembership, type InsertCompanyMembership, type UserSettings, type InsertUserSettings, type EnterpriseDocument, type InsertEnterpriseDocument, type OtpCode, type InsertOtpCode, type DeviceTrust, type InsertDeviceTrust, type SchedulerConfig, type InsertSchedulerConfig, type Domain, type InsertDomain, type DomainUser, type InsertDomainUser, type DomainSchedulerConfig, type InsertDomainSchedulerConfig, type KioskFaqDocument, type InsertKioskFaqDocument, type KioskChat, type InsertKioskChat, type KioskMessage, type InsertKioskMessage, type KioskFaqEntry, type InsertKioskFaqEntry, type DomainApiConnector, type InsertDomainApiConnector, type Cube, type InsertCube, type CubeUserAccess, type InsertCubeUserAccess, type CubeMetadata, type InsertCubeMetadata, type AzureBlobFileRegistry, users, chats, messages, documents, boards, boardTemplates, boardThreads, boardDocuments, boardDataSources, chatDocuments, queryAudit, companies, companyMemberships, userSettings, enterpriseDocuments, enterpriseDocumentProcessing, otpCodes, deviceTrust, schedulerConfig, domains, domainUsers, domainSchedulerConfig, kioskFaqDocuments, kioskChats, kioskMessages, kioskFaqEntries, domainApiConnectors, cubes, cubeUserAccess, cubeMetadata, azureBlobFileRegistry } from "@shared/schema";
import { db } from "./db";
import { eq, desc, asc, count, and, sql as sqlOp, inArray } from "drizzle-orm";
import bcrypt from "bcryptjs";

export interface EnterpriseDocumentListItem {
  id: string;
  companyId: string;
  uploadedBy: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  fileType: string;
  source: string;
  uploadedAt: Date;
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
  chunkCount: number;
  errorMessage?: string | null;
  cubeId?: string | null;
}

export interface IStorage {
  db: typeof db;
  
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  verifyPassword(username: string, password: string): Promise<User | null>;
  getAllUsers(): Promise<User[]>;
  deleteUser(id: string): Promise<void>;
  
  getChats(userId: string): Promise<Chat[]>;
  getChat(id: string): Promise<Chat | undefined>;
  createChat(chat: InsertChat): Promise<Chat>;
  updateChatTitle(id: string, title: string): Promise<Chat | undefined>;
  deleteChat(id: string): Promise<void>;
  
  getMessages(chatId: string): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  
  getDocuments(userId: string): Promise<Document[]>;
  getDocument(id: string): Promise<Document | undefined>;
  createDocument(document: InsertDocument): Promise<Document>;
  deleteDocument(id: string): Promise<void>;
  
  getBoards(userId: string): Promise<Board[]>;
  getBoard(id: string): Promise<Board | undefined>;
  createBoard(board: InsertBoard): Promise<Board>;
  updateBoard(id: string, board: Partial<InsertBoard>): Promise<Board | undefined>;
  deleteBoard(id: string): Promise<void>;
  
  getBoardTemplates(): Promise<BoardTemplate[]>;
  getBoardTemplate(id: string): Promise<BoardTemplate | undefined>;
  createBoardTemplate(template: InsertBoardTemplate): Promise<BoardTemplate>;
  updateBoardTemplate(id: string, template: Partial<InsertBoardTemplate>): Promise<BoardTemplate | undefined>;
  deleteBoardTemplate(id: string): Promise<void>;
  
  getBoardThreads(boardId: string): Promise<Chat[]>;
  addBoardThread(thread: InsertBoardThread): Promise<BoardThread>;
  removeBoardThread(boardId: string, chatId: string): Promise<void>;
  
  getBoardDocuments(boardId: string): Promise<Document[]>;
  addBoardDocument(boardDoc: InsertBoardDocument): Promise<BoardDocument>;
  removeBoardDocument(boardId: string, documentId: string): Promise<void>;
  
  getBoardDataSources(boardId: string): Promise<BoardDataSource[]>;
  createBoardDataSource(dataSource: InsertBoardDataSource): Promise<BoardDataSource>;
  updateBoardDataSource(id: string, dataSource: Partial<InsertBoardDataSource>): Promise<BoardDataSource | undefined>;
  deleteBoardDataSource(id: string): Promise<void>;
  reorderBoardDataSources(boardId: string, sourceIds: string[]): Promise<void>;
  
  getChatDocuments(chatId: string): Promise<Document[]>;
  associateDocumentWithChat(chatId: string, documentId: string): Promise<void>;
  deleteChatDocuments(chatId: string): Promise<void>;
  getChatMessageCount(chatId: string): Promise<number>;
  getDocumentSessionCount(documentId: string): Promise<number>;
  
  createQueryAudit(audit: InsertQueryAudit): Promise<QueryAudit>;
  
  getCompany(id: string): Promise<Company | undefined>;
  getCompanyBySlug(slug: string): Promise<Company | undefined>;
  findCompanyByNormalizedDomain(domain: string): Promise<Company | undefined>;
  createCompany(company: InsertCompany): Promise<Company>;
  
  getUserCompanyMemberships(userId: string): Promise<CompanyMembership[]>;
  getCompanyMembership(userId: string, companyId: string): Promise<CompanyMembership | undefined>;
  createCompanyMembership(membership: InsertCompanyMembership): Promise<CompanyMembership>;
  
  getUserSettings(userId: string): Promise<UserSettings | undefined>;
  createUserSettings(settings: InsertUserSettings): Promise<UserSettings>;
  updateUserSettings(userId: string, updates: Partial<InsertUserSettings>): Promise<UserSettings | undefined>;
  
  getEnterpriseDocuments(companyId: string): Promise<EnterpriseDocumentListItem[]>;
  getEnterpriseDocumentsByDomain(domainId: string): Promise<EnterpriseDocumentListItem[]>;
  getEnterpriseDocument(id: string): Promise<EnterpriseDocument | undefined>;
  createEnterpriseDocument(document: InsertEnterpriseDocument): Promise<EnterpriseDocument>;
  deleteEnterpriseDocument(id: string): Promise<void>;
  
  getSchedulerConfig(): Promise<SchedulerConfig | undefined>;
  upsertSchedulerConfig(config: Partial<InsertSchedulerConfig>): Promise<SchedulerConfig>;
  
  createOtpCode(otpCode: InsertOtpCode): Promise<OtpCode>;
  getActiveOtpCode(userId: string, context: string): Promise<OtpCode | undefined>;
  consumeOtpCode(id: string): Promise<void>;
  incrementOtpAttempts(id: string): Promise<void>;
  cleanupExpiredOtpCodes(): Promise<void>;
  
  createDeviceTrust(device: InsertDeviceTrust): Promise<DeviceTrust>;
  getUserDevices(userId: string): Promise<DeviceTrust[]>;
  getDeviceTrustByToken(deviceTokenHash: string): Promise<DeviceTrust | undefined>;
  updateDeviceLastUsed(id: string): Promise<void>;
  deleteDeviceTrust(id: string): Promise<void>;
  cleanupExpiredDevices(): Promise<void>;
  
  updateUserLastLogin(id: string): Promise<void>;
  updateUserRole(id: string, role: string): Promise<void>;
  
  getVaultStats(userId: string): Promise<{ totalDocuments: number; vectorIndexed: number; currentSessions: number; totalSessions: number; }>;
  
  // Domain management methods (Super Admin)
  getAllDomains(): Promise<Domain[]>;
  getDomain(id: string): Promise<Domain | undefined>;
  getDomainByName(name: string): Promise<Domain | undefined>;
  createDomain(domain: InsertDomain): Promise<Domain>;
  updateDomain(id: string, updates: Partial<InsertDomain>): Promise<Domain | undefined>;
  deleteDomain(id: string): Promise<void>;
  
  // Domain Users methods (Domain Admin)
  getDomainUsers(domainId: string): Promise<DomainUser[]>;
  getDomainUser(id: string): Promise<DomainUser | undefined>;
  getDomainUserByEmail(email: string): Promise<DomainUser | undefined>;
  createDomainUser(domainUser: InsertDomainUser): Promise<DomainUser>;
  updateDomainUser(id: string, updates: Partial<InsertDomainUser>): Promise<DomainUser | undefined>;
  deleteDomainUser(id: string): Promise<void>;
  getDomainByAdminEmail(email: string): Promise<Domain | undefined>;
  getDomainUserCount(domainId: string): Promise<number>;
  getDomainAdmins(domainId: string): Promise<DomainUser[]>;
  
  // Domain Scheduler Config methods
  getDomainSchedulerConfig(domainId: string): Promise<DomainSchedulerConfig | undefined>;
  getAllDomainSchedulerConfigs(): Promise<DomainSchedulerConfig[]>;
  upsertDomainSchedulerConfig(domainId: string, config: Partial<InsertDomainSchedulerConfig>): Promise<DomainSchedulerConfig>;
  
  // Kiosk FAQ methods
  getKioskFaqDocuments(domainId: string): Promise<KioskFaqDocument[]>;
  getKioskFaqDocument(id: string): Promise<KioskFaqDocument | undefined>;
  createKioskFaqDocument(doc: InsertKioskFaqDocument): Promise<KioskFaqDocument>;
  updateKioskFaqDocumentStatus(id: string, status: string): Promise<KioskFaqDocument | undefined>;
  deleteKioskFaqDocument(id: string): Promise<void>;
  
  // Kiosk FAQ Entry methods
  getKioskFaqEntries(domainId: string): Promise<KioskFaqEntry[]>;
  getKioskFaqEntriesByDocument(documentId: string): Promise<KioskFaqEntry[]>;
  createKioskFaqEntry(entry: InsertKioskFaqEntry): Promise<KioskFaqEntry>;
  createKioskFaqEntriesBulk(entries: InsertKioskFaqEntry[]): Promise<KioskFaqEntry[]>;
  deleteKioskFaqEntriesByDocument(documentId: string): Promise<void>;
  
  // Kiosk Chat methods
  getKioskChats(userId: string, domainId: string): Promise<KioskChat[]>;
  getKioskChat(id: string): Promise<KioskChat | undefined>;
  createKioskChat(chat: InsertKioskChat): Promise<KioskChat>;
  updateKioskChatTitle(id: string, title: string): Promise<KioskChat | undefined>;
  deleteKioskChat(id: string): Promise<void>;
  
  // Kiosk Message methods
  getKioskMessages(chatId: string): Promise<KioskMessage[]>;
  createKioskMessage(message: InsertKioskMessage): Promise<KioskMessage>;
  
  // Domain API Connectors methods
  getDomainApiConnectors(domainId: string): Promise<DomainApiConnector[]>;
  getDomainApiConnector(domainId: string, connectorType: string): Promise<DomainApiConnector | undefined>;
  getDomainApiConnectorById(id: string): Promise<DomainApiConnector | undefined>;
  getEnabledDomainApiConnectors(domainId: string): Promise<DomainApiConnector[]>;
  createDomainApiConnector(connector: InsertDomainApiConnector): Promise<DomainApiConnector>;
  updateDomainApiConnector(id: string, updates: Partial<InsertDomainApiConnector>): Promise<DomainApiConnector | undefined>;
  deleteDomainApiConnector(id: string): Promise<void>;
  updateDomainApiConnectorStatus(id: string, status: string, syncResult?: string, documentCount?: number): Promise<void>;

  // Azure Blob File Registry — delta-sync tracking (new files only)
  getBlobRegistryForConnector(connectorId: string): Promise<Map<string, AzureBlobFileRegistry>>;
  upsertBlobRegistryEntry(data: { connectorId: string; blobName: string; etag: string; lastModified?: Date; documentId?: string; jobId?: string; status: string }): Promise<AzureBlobFileRegistry>;
  
  // Cube methods for data segregation
  getCubes(domainId: string): Promise<Cube[]>;
  getCube(id: string): Promise<Cube | undefined>;
  getCubeByName(domainId: string, name: string): Promise<Cube | undefined>;
  createCube(cube: InsertCube): Promise<Cube>;
  updateCube(id: string, updates: Partial<InsertCube>): Promise<Cube | undefined>;
  deleteCube(id: string): Promise<void>;
  clearCubeFactData(cubeId: string): Promise<number>;
  getCubeDocumentCount(cubeId: string): Promise<number>;
  
  // Cube user access methods
  getCubeUserAccess(cubeId: string): Promise<CubeUserAccess[]>;
  getUserCubeAccess(userEmail: string, domainId: string): Promise<CubeUserAccess[]>;
  getCubeAccessForUser(cubeId: string, userEmail: string): Promise<CubeUserAccess | undefined>;
  grantCubeAccess(access: InsertCubeUserAccess): Promise<CubeUserAccess>;
  updateCubeAccess(id: string, enabled: number): Promise<CubeUserAccess | undefined>;
  revokeCubeAccess(cubeId: string, userEmail: string): Promise<void>;
  getAccessibleCubeIds(userEmail: string, domainId: string): Promise<string[]>;
  
  // Cube metadata methods for structured data indexing
  getCubeMetadata(cubeId: string): Promise<CubeMetadata | undefined>;
  upsertCubeMetadata(metadata: InsertCubeMetadata): Promise<CubeMetadata>;
  deleteCubeMetadata(cubeId: string): Promise<void>;
}

export class DbStorage implements IStorage {
  public db = db;
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    // Case-insensitive lookup - normalize to lowercase
    const usernameLower = username.toLowerCase();
    const result = await db.select().from(users).where(eq(users.username, usernameLower));
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const hashedPassword = await bcrypt.hash(insertUser.password, 10);
    // Normalize username (email) to lowercase for case-insensitive login
    const result = await db.insert(users).values({
      ...insertUser,
      username: insertUser.username.toLowerCase(),
      password: hashedPassword,
    }).returning();
    return result[0];
  }

  async verifyPassword(username: string, password: string): Promise<User | null> {
    // getUserByUsername already normalizes to lowercase
    const user = await this.getUserByUsername(username);
    if (!user) return null;
    
    const isValid = await bcrypt.compare(password, user.password);
    return isValid ? user : null;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(asc(users.displayName));
  }

  async deleteUser(id: string): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  async getChats(userId: string): Promise<Chat[]> {
    return db.select().from(chats).where(eq(chats.userId, userId)).orderBy(desc(chats.createdAt));
  }

  async getChat(id: string): Promise<Chat | undefined> {
    const result = await db.select().from(chats).where(eq(chats.id, id));
    return result[0];
  }

  async createChat(insertChat: InsertChat): Promise<Chat> {
    const result = await db.insert(chats).values(insertChat).returning();
    return result[0];
  }

  async updateChatTitle(id: string, title: string): Promise<Chat | undefined> {
    const result = await db.update(chats).set({ title }).where(eq(chats.id, id)).returning();
    return result[0];
  }

  async deleteChat(id: string): Promise<void> {
    // Delete related data first (messages and chat_documents are deleted via cascade)
    // Then delete the chat itself
    await db.delete(chatDocuments).where(eq(chatDocuments.chatId, id));
    await db.delete(messages).where(eq(messages.chatId, id));
    await db.delete(chats).where(eq(chats.id, id));
  }

  async getMessages(chatId: string): Promise<Message[]> {
    return db.select().from(messages).where(eq(messages.chatId, chatId)).orderBy(asc(messages.createdAt));
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const result = await db.insert(messages).values(insertMessage).returning();
    return result[0];
  }

  async getDocuments(userId: string): Promise<Document[]> {
    return db.select().from(documents).where(eq(documents.userId, userId)).orderBy(desc(documents.uploadedAt));
  }

  async getDocument(id: string): Promise<Document | undefined> {
    const result = await db.select().from(documents).where(eq(documents.id, id));
    return result[0];
  }

  async createDocument(insertDocument: InsertDocument): Promise<Document> {
    const result = await db.insert(documents).values(insertDocument).returning();
    return result[0];
  }

  async deleteDocument(id: string): Promise<void> {
    await db.delete(documents).where(eq(documents.id, id));
  }

  async getBoards(userId: string): Promise<Board[]> {
    return db.select().from(boards).where(eq(boards.userId, userId)).orderBy(desc(boards.createdAt));
  }

  async getBoard(id: string): Promise<Board | undefined> {
    const result = await db.select().from(boards).where(eq(boards.id, id));
    return result[0];
  }

  async createBoard(insertBoard: InsertBoard): Promise<Board> {
    const result = await db.insert(boards).values(insertBoard).returning();
    return result[0];
  }

  async updateBoard(id: string, updates: Partial<InsertBoard>): Promise<Board | undefined> {
    const result = await db.update(boards).set(updates).where(eq(boards.id, id)).returning();
    return result[0];
  }

  async deleteBoard(id: string): Promise<void> {
    await db.delete(boards).where(eq(boards.id, id));
  }

  async getBoardTemplates(): Promise<BoardTemplate[]> {
    return db.select().from(boardTemplates).orderBy(asc(boardTemplates.name));
  }

  async getBoardTemplate(id: string): Promise<BoardTemplate | undefined> {
    const result = await db.select().from(boardTemplates).where(eq(boardTemplates.id, id));
    return result[0];
  }

  async createBoardTemplate(template: InsertBoardTemplate): Promise<BoardTemplate> {
    const result = await db.insert(boardTemplates).values(template).returning();
    return result[0];
  }

  async updateBoardTemplate(id: string, updates: Partial<InsertBoardTemplate>): Promise<BoardTemplate | undefined> {
    const result = await db.update(boardTemplates).set(updates).where(eq(boardTemplates.id, id)).returning();
    return result[0];
  }

  async deleteBoardTemplate(id: string): Promise<void> {
    await db.delete(boardTemplates).where(eq(boardTemplates.id, id));
  }

  async getBoardThreads(boardId: string): Promise<Chat[]> {
    const result = await db.select({
      id: chats.id,
      userId: chats.userId,
      title: chats.title,
      preview: chats.preview,
      createdAt: chats.createdAt,
    })
    .from(boardThreads)
    .innerJoin(chats, eq(boardThreads.chatId, chats.id))
    .where(eq(boardThreads.boardId, boardId))
    .orderBy(desc(chats.createdAt));
    
    return result;
  }

  async addBoardThread(thread: InsertBoardThread): Promise<BoardThread> {
    const result = await db.insert(boardThreads).values(thread).returning();
    return result[0];
  }

  async removeBoardThread(boardId: string, chatId: string): Promise<void> {
    await db.delete(boardThreads)
      .where(and(eq(boardThreads.boardId, boardId), eq(boardThreads.chatId, chatId)));
  }

  async getBoardDocuments(boardId: string): Promise<Document[]> {
    const result = await db.select({
      id: documents.id,
      userId: documents.userId,
      name: documents.name,
      filePath: documents.filePath,
      fileSize: documents.fileSize,
      fileType: documents.fileType,
      cloudSource: documents.cloudSource,
      cloudFileId: documents.cloudFileId,
      cloudUrl: documents.cloudUrl,
      uploadedAt: documents.uploadedAt,
    })
    .from(boardDocuments)
    .innerJoin(documents, eq(boardDocuments.documentId, documents.id))
    .where(eq(boardDocuments.boardId, boardId))
    .orderBy(desc(documents.uploadedAt));
    
    return result;
  }

  async addBoardDocument(boardDoc: InsertBoardDocument): Promise<BoardDocument> {
    const result = await db.insert(boardDocuments).values(boardDoc).returning();
    return result[0];
  }

  async removeBoardDocument(boardId: string, documentId: string): Promise<void> {
    await db.delete(boardDocuments)
      .where(and(eq(boardDocuments.boardId, boardId), eq(boardDocuments.documentId, documentId)));
  }

  async getBoardDataSources(boardId: string): Promise<BoardDataSource[]> {
    return db.select().from(boardDataSources)
      .where(eq(boardDataSources.boardId, boardId))
      .orderBy(asc(boardDataSources.position));
  }

  async createBoardDataSource(dataSource: InsertBoardDataSource): Promise<BoardDataSource> {
    const result = await db.insert(boardDataSources).values(dataSource).returning();
    return result[0];
  }

  async updateBoardDataSource(id: string, updates: Partial<InsertBoardDataSource>): Promise<BoardDataSource | undefined> {
    const result = await db.update(boardDataSources).set(updates).where(eq(boardDataSources.id, id)).returning();
    return result[0];
  }

  async deleteBoardDataSource(id: string): Promise<void> {
    await db.delete(boardDataSources).where(eq(boardDataSources.id, id));
  }

  async reorderBoardDataSources(boardId: string, sourceIds: string[]): Promise<void> {
    for (let i = 0; i < sourceIds.length; i++) {
      await db.update(boardDataSources)
        .set({ position: i })
        .where(and(eq(boardDataSources.id, sourceIds[i]), eq(boardDataSources.boardId, boardId)));
    }
  }

  async getChatDocuments(chatId: string): Promise<Document[]> {
    const result = await db.select({
      id: documents.id,
      userId: documents.userId,
      name: documents.name,
      filePath: documents.filePath,
      fileSize: documents.fileSize,
      fileType: documents.fileType,
      cloudSource: documents.cloudSource,
      cloudFileId: documents.cloudFileId,
      cloudUrl: documents.cloudUrl,
      uploadedAt: documents.uploadedAt,
    })
    .from(chatDocuments)
    .innerJoin(documents, eq(chatDocuments.documentId, documents.id))
    .where(eq(chatDocuments.chatId, chatId));
    
    return result.map(row => ({
      id: row.id,
      userId: row.userId,
      name: row.name,
      filePath: row.filePath,
      fileSize: row.fileSize,
      fileType: row.fileType,
      cloudSource: row.cloudSource,
      cloudFileId: row.cloudFileId,
      cloudUrl: row.cloudUrl,
      uploadedAt: row.uploadedAt,
    }));
  }

  async associateDocumentWithChat(chatId: string, documentId: string): Promise<void> {
    await db.insert(chatDocuments).values({
      chatId,
      documentId,
    });
  }

  async deleteChatDocuments(chatId: string): Promise<void> {
    await db.delete(chatDocuments).where(eq(chatDocuments.chatId, chatId));
  }

  async getChatMessageCount(chatId: string): Promise<number> {
    const result = await db
      .select({ count: count(messages.id) })
      .from(messages)
      .where(eq(messages.chatId, chatId));
    return result[0]?.count || 0;
  }

  async getDocumentSessionCount(documentId: string): Promise<number> {
    const result = await db
      .select({ count: count(chatDocuments.id) })
      .from(chatDocuments)
      .where(eq(chatDocuments.documentId, documentId));
    return result[0]?.count || 0;
  }

  async createQueryAudit(insertAudit: InsertQueryAudit): Promise<QueryAudit> {
    const result = await db.insert(queryAudit).values(insertAudit).returning();
    return result[0];
  }

  async getCompany(id: string): Promise<Company | undefined> {
    const result = await db.select().from(companies).where(eq(companies.id, id));
    return result[0];
  }

  async getCompanyBySlug(slug: string): Promise<Company | undefined> {
    const result = await db.select().from(companies).where(eq(companies.slug, slug));
    return result[0];
  }

  async findCompanyByNormalizedDomain(domain: string): Promise<Company | undefined> {
    const domainLower = domain.toLowerCase();
    const domainParts = domainLower.split('.');
    
    const baseLabel = domainParts[0];
    
    const exactSlug = domainLower.replace(/\./g, '-');
    const normalizedDomain = domainLower.replace(/[.-]/g, '');
    
    const allCompanies = await db.select().from(companies);
    
    for (const company of allCompanies) {
      const companySlug = company.slug.toLowerCase();
      const companyNormalized = companySlug.replace(/[.-]/g, '');
      
      if (companySlug === exactSlug || companySlug === baseLabel) {
        return company;
      }
      if (companyNormalized === normalizedDomain || companyNormalized === baseLabel) {
        return company;
      }
    }
    
    return undefined;
  }

  async createCompany(insertCompany: InsertCompany): Promise<Company> {
    const result = await db.insert(companies).values(insertCompany).returning();
    return result[0];
  }

  async getUserCompanyMemberships(userId: string): Promise<CompanyMembership[]> {
    return db.select().from(companyMemberships).where(eq(companyMemberships.userId, userId));
  }

  async getCompanyMembership(userId: string, companyId: string): Promise<CompanyMembership | undefined> {
    const result = await db.select().from(companyMemberships)
      .where(and(
        eq(companyMemberships.userId, userId),
        eq(companyMemberships.companyId, companyId)
      ));
    return result[0];
  }

  async createCompanyMembership(insertMembership: InsertCompanyMembership): Promise<CompanyMembership> {
    const result = await db.insert(companyMemberships).values(insertMembership).returning();
    return result[0];
  }

  async getUserSettings(userId: string): Promise<UserSettings | undefined> {
    const result = await db.select().from(userSettings).where(eq(userSettings.userId, userId));
    return result[0];
  }

  async createUserSettings(insertSettings: InsertUserSettings): Promise<UserSettings> {
    const result = await db.insert(userSettings).values(insertSettings).returning();
    return result[0];
  }

  async updateUserSettings(userId: string, updates: Partial<InsertUserSettings>): Promise<UserSettings | undefined> {
    const result = await db.update(userSettings)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(userSettings.userId, userId))
      .returning();
    return result[0];
  }

  async getEnterpriseDocuments(companyId: string): Promise<EnterpriseDocumentListItem[]> {
    const results = await db
      .select({
        id: enterpriseDocuments.id,
        companyId: enterpriseDocuments.companyId,
        uploadedBy: enterpriseDocuments.uploadedBy,
        fileName: enterpriseDocuments.name,
        filePath: enterpriseDocuments.filePath,
        fileSize: enterpriseDocuments.fileSize,
        fileType: enterpriseDocuments.fileType,
        source: enterpriseDocuments.source,
        uploadedAt: enterpriseDocuments.uploadedAt,
        processingStatus: sqlOp<'pending' | 'processing' | 'completed' | 'failed'>`COALESCE(${enterpriseDocumentProcessing.status}, 'pending')`,
        chunkCount: sqlOp<number>`COALESCE(${enterpriseDocumentProcessing.totalChunks}, 0)`,
        errorMessage: enterpriseDocumentProcessing.errorMessage,
      })
      .from(enterpriseDocuments)
      .leftJoin(
        enterpriseDocumentProcessing,
        eq(enterpriseDocuments.id, enterpriseDocumentProcessing.documentId)
      )
      .where(eq(enterpriseDocuments.companyId, companyId))
      .orderBy(desc(enterpriseDocuments.uploadedAt));

    return results.map(row => ({
      ...row,
      fileSize: parseInt(row.fileSize),
    }));
  }

  async getEnterpriseDocumentsByDomain(domainId: string): Promise<EnterpriseDocumentListItem[]> {
    const results = await db
      .select({
        id: enterpriseDocuments.id,
        companyId: enterpriseDocuments.companyId,
        uploadedBy: enterpriseDocuments.uploadedBy,
        fileName: enterpriseDocuments.name,
        filePath: enterpriseDocuments.filePath,
        fileSize: enterpriseDocuments.fileSize,
        fileType: enterpriseDocuments.fileType,
        source: enterpriseDocuments.source,
        uploadedAt: enterpriseDocuments.uploadedAt,
        processingStatus: sqlOp<'pending' | 'processing' | 'completed' | 'failed'>`COALESCE(${enterpriseDocumentProcessing.status}, 'pending')`,
        chunkCount: sqlOp<number>`COALESCE(${enterpriseDocumentProcessing.totalChunks}, 0)`,
        errorMessage: enterpriseDocumentProcessing.errorMessage,
        cubeId: enterpriseDocuments.cubeId,
      })
      .from(enterpriseDocuments)
      .leftJoin(
        enterpriseDocumentProcessing,
        eq(enterpriseDocuments.id, enterpriseDocumentProcessing.documentId)
      )
      .where(eq(enterpriseDocuments.domainId, domainId))
      .orderBy(desc(enterpriseDocuments.uploadedAt));

    return results.map(row => ({
      ...row,
      fileSize: parseInt(row.fileSize),
    }));
  }

  async getEnterpriseDocument(id: string): Promise<EnterpriseDocument | undefined> {
    const result = await db.select().from(enterpriseDocuments).where(eq(enterpriseDocuments.id, id));
    return result[0];
  }

  async createEnterpriseDocument(insertDocument: InsertEnterpriseDocument): Promise<EnterpriseDocument> {
    const result = await db.insert(enterpriseDocuments).values(insertDocument).returning();
    return result[0];
  }

  async deleteEnterpriseDocument(id: string): Promise<void> {
    // Get the document to find its cube_id before deletion
    const document = await db.select().from(enterpriseDocuments).where(eq(enterpriseDocuments.id, id));
    const cubeId = document[0]?.cubeId;
    
    // Delete processing records first (foreign key dependency)
    await db.delete(enterpriseDocumentProcessing).where(eq(enterpriseDocumentProcessing.documentId, id));
    
    // Delete the document itself
    await db.delete(enterpriseDocuments).where(eq(enterpriseDocuments.id, id));
    
    // Clear all cube data tables when no documents remain for this cube
    if (cubeId) {
      // Check if there are any remaining documents for this cube
      const remainingDocs = await db.select({ count: sqlOp<number>`count(*)` })
        .from(enterpriseDocuments)
        .where(eq(enterpriseDocuments.cubeId, cubeId));
      
      // Fix: COUNT(*) returns a string from PostgreSQL — convert to number before comparing
      const remainingCount = Number(remainingDocs[0]?.count ?? 0);

      if (remainingCount === 0) {
        console.log(`No remaining documents for cube ${cubeId}, clearing all cube data tables...`);
        await db.execute(sqlOp`DELETE FROM cube_fact_data WHERE cube_id = ${cubeId}`);
        console.log(`  - Cleared cube_fact_data`);
        await db.execute(sqlOp`DELETE FROM cube_dimensions WHERE cube_id = ${cubeId}`);
        console.log(`  - Cleared cube_dimensions`);
        await db.execute(sqlOp`DELETE FROM cube_cost_categories WHERE cube_id = ${cubeId}`);
        console.log(`  - Cleared cube_cost_categories`);
        await db.execute(sqlOp`DELETE FROM cube_plan_data WHERE cube_id = ${cubeId}`);
        console.log(`  - Cleared cube_plan_data`);
        await db.execute(sqlOp`DELETE FROM cube_ingestion_jobs WHERE cube_id = ${cubeId}`);
        console.log(`  - Cleared cube_ingestion_jobs`);
        console.log(`✅ All cube data cleared for cube ${cubeId}`);
      }
    }
  }

  async clearCubeFactData(cubeId: string): Promise<number> {
    // Clear all SQL fact data for a specific cube
    const result = await db.execute(
      sqlOp`DELETE FROM cube_fact_data WHERE cube_id = ${cubeId} RETURNING id`
    );
    return (result as any).rowCount || 0;
  }

  async getSchedulerConfig(): Promise<SchedulerConfig | undefined> {
    const result = await db.select().from(schedulerConfig).limit(1);
    return result[0];
  }

  async upsertSchedulerConfig(config: Partial<InsertSchedulerConfig>): Promise<SchedulerConfig> {
    const existing = await this.getSchedulerConfig();
    
    if (existing) {
      const result = await db
        .update(schedulerConfig)
        .set({ ...config, updatedAt: new Date() })
        .where(eq(schedulerConfig.id, existing.id))
        .returning();
      return result[0];
    } else {
      const result = await db
        .insert(schedulerConfig)
        .values({ ...config } as InsertSchedulerConfig)
        .returning();
      return result[0];
    }
  }

  async createOtpCode(insertOtpCode: InsertOtpCode): Promise<OtpCode> {
    const result = await db.insert(otpCodes).values(insertOtpCode).returning();
    return result[0];
  }

  async getActiveOtpCode(userId: string, context: string): Promise<OtpCode | undefined> {
    const result = await db.select().from(otpCodes)
      .where(and(
        eq(otpCodes.userId, userId),
        eq(otpCodes.context, context),
        sqlOp`${otpCodes.expiresAt} > NOW()`,
        sqlOp`${otpCodes.consumedAt} IS NULL`
      ))
      .orderBy(desc(otpCodes.createdAt))
      .limit(1);
    return result[0];
  }

  async consumeOtpCode(id: string): Promise<void> {
    await db.update(otpCodes)
      .set({ consumedAt: new Date() })
      .where(eq(otpCodes.id, id));
  }

  async incrementOtpAttempts(id: string): Promise<void> {
    await db.update(otpCodes)
      .set({ attempts: sqlOp`${otpCodes.attempts} + 1` })
      .where(eq(otpCodes.id, id));
  }

  async cleanupExpiredOtpCodes(): Promise<void> {
    await db.delete(otpCodes)
      .where(sqlOp`${otpCodes.expiresAt} < NOW() - INTERVAL '1 day'`);
  }

  async createDeviceTrust(insertDevice: InsertDeviceTrust): Promise<DeviceTrust> {
    const result = await db.insert(deviceTrust).values(insertDevice).returning();
    return result[0];
  }

  async getUserDevices(userId: string): Promise<DeviceTrust[]> {
    return db.select().from(deviceTrust)
      .where(eq(deviceTrust.userId, userId))
      .orderBy(desc(deviceTrust.lastUsedAt));
  }

  async getDeviceTrustByToken(deviceTokenHash: string): Promise<DeviceTrust | undefined> {
    const result = await db.select().from(deviceTrust)
      .where(and(
        eq(deviceTrust.deviceTokenHash, deviceTokenHash),
        sqlOp`${deviceTrust.expiresAt} > NOW()`
      ));
    return result[0];
  }

  async updateDeviceLastUsed(id: string): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 10);
    
    await db.update(deviceTrust)
      .set({ 
        lastUsedAt: new Date(),
        expiresAt
      })
      .where(eq(deviceTrust.id, id));
  }

  async deleteDeviceTrust(id: string): Promise<void> {
    await db.delete(deviceTrust).where(eq(deviceTrust.id, id));
  }

  async cleanupExpiredDevices(): Promise<void> {
    await db.delete(deviceTrust)
      .where(sqlOp`${deviceTrust.expiresAt} < NOW()`);
  }

  async updateUserLastLogin(id: string): Promise<void> {
    await db.update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, id));
  }

  async updateUserRole(id: string, role: string): Promise<void> {
    await db.update(users)
      .set({ role })
      .where(eq(users.id, id));
  }

  async getVaultStats(userId: string): Promise<{ totalDocuments: number; vectorIndexed: number; currentSessions: number; totalSessions: number; }> {
    const [totalDocsResult] = await db
      .select({ count: count() })
      .from(documents)
      .where(eq(documents.userId, userId));
    
    const vectorIndexedResult = await db.execute(sqlOp`
      SELECT COUNT(DISTINCT dc.document_id) as count
      FROM document_embeddings de
      JOIN document_chunks dc ON de.chunk_id = dc.id
      JOIN documents d ON dc.document_id = d.id
      WHERE d.user_id = ${userId}
    `);
    
    const [totalChatsResult] = await db
      .select({ count: count() })
      .from(chats)
      .where(eq(chats.userId, userId));
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const [recentChatsResult] = await db
      .select({ count: count() })
      .from(chats)
      .where(and(
        eq(chats.userId, userId),
        sqlOp`${chats.createdAt} > ${thirtyDaysAgo}`
      ));

    return {
      totalDocuments: totalDocsResult.count,
      vectorIndexed: Number((vectorIndexedResult.rows[0] as any)?.count || 0),
      currentSessions: recentChatsResult.count,
      totalSessions: totalChatsResult.count,
    };
  }

  // Domain management methods (Super Admin)
  async getAllDomains(): Promise<Domain[]> {
    return db.select().from(domains).orderBy(asc(domains.name));
  }

  async getDomain(id: string): Promise<Domain | undefined> {
    const result = await db.select().from(domains).where(eq(domains.id, id));
    return result[0];
  }

  async getDomainByName(name: string): Promise<Domain | undefined> {
    const result = await db.select().from(domains).where(eq(domains.name, name.toLowerCase()));
    return result[0];
  }

  async createDomain(insertDomain: InsertDomain): Promise<Domain> {
    const result = await db.insert(domains).values({
      ...insertDomain,
      name: insertDomain.name.toLowerCase(),
    }).returning();
    return result[0];
  }

  async updateDomain(id: string, updates: Partial<InsertDomain>): Promise<Domain | undefined> {
    const updateData = { ...updates };
    if (updates.name) {
      updateData.name = updates.name.toLowerCase();
    }
    const result = await db.update(domains).set(updateData).where(eq(domains.id, id)).returning();
    return result[0];
  }

  async deleteDomain(id: string): Promise<void> {
    await db.delete(domains).where(eq(domains.id, id));
  }

  // Domain Users methods (Domain Admin)
  async getDomainUsers(domainId: string): Promise<DomainUser[]> {
    return db.select().from(domainUsers).where(eq(domainUsers.domainId, domainId)).orderBy(asc(domainUsers.email));
  }

  async getDomainUser(id: string): Promise<DomainUser | undefined> {
    const result = await db.select().from(domainUsers).where(eq(domainUsers.id, id));
    return result[0];
  }

  async getDomainUserByEmail(email: string): Promise<DomainUser | undefined> {
    const result = await db.select().from(domainUsers).where(eq(domainUsers.email, email.toLowerCase()));
    return result[0];
  }

  async createDomainUser(insertDomainUser: InsertDomainUser): Promise<DomainUser> {
    const result = await db.insert(domainUsers).values({
      ...insertDomainUser,
      email: insertDomainUser.email.toLowerCase(),
    }).returning();
    return result[0];
  }

  async updateDomainUser(id: string, updates: Partial<InsertDomainUser>): Promise<DomainUser | undefined> {
    const updateData = { ...updates };
    if (updates.email) {
      updateData.email = updates.email.toLowerCase();
    }
    const result = await db.update(domainUsers).set(updateData).where(eq(domainUsers.id, id)).returning();
    return result[0];
  }

  async deleteDomainUser(id: string): Promise<void> {
    await db.delete(domainUsers).where(eq(domainUsers.id, id));
  }

  async getDomainByAdminEmail(email: string): Promise<Domain | undefined> {
    const result = await db.select().from(domains).where(eq(domains.adminEmail, email.toLowerCase()));
    return result[0];
  }

  async getDomainUserCount(domainId: string): Promise<number> {
    const result = await db
      .select({ count: count(domainUsers.id) })
      .from(domainUsers)
      .where(eq(domainUsers.domainId, domainId));
    return result[0]?.count || 0;
  }

  async getDomainAdmins(domainId: string): Promise<DomainUser[]> {
    return db
      .select()
      .from(domainUsers)
      .where(and(
        eq(domainUsers.domainId, domainId),
        eq(domainUsers.role, 'admin')
      ))
      .orderBy(asc(domainUsers.email));
  }

  async getDomainSchedulerConfig(domainId: string): Promise<DomainSchedulerConfig | undefined> {
    const result = await db
      .select()
      .from(domainSchedulerConfig)
      .where(eq(domainSchedulerConfig.domainId, domainId));
    return result[0];
  }

  async getAllDomainSchedulerConfigs(): Promise<DomainSchedulerConfig[]> {
    return db.select().from(domainSchedulerConfig);
  }

  async upsertDomainSchedulerConfig(domainId: string, config: Partial<InsertDomainSchedulerConfig>): Promise<DomainSchedulerConfig> {
    const existing = await this.getDomainSchedulerConfig(domainId);
    
    if (existing) {
      const result = await db
        .update(domainSchedulerConfig)
        .set({
          ...config,
          updatedAt: new Date(),
        })
        .where(eq(domainSchedulerConfig.domainId, domainId))
        .returning();
      return result[0];
    } else {
      const result = await db
        .insert(domainSchedulerConfig)
        .values({
          domainId,
          ...config,
        })
        .returning();
      return result[0];
    }
  }

  // Kiosk FAQ Document methods
  async getKioskFaqDocuments(domainId: string): Promise<KioskFaqDocument[]> {
    return db.select().from(kioskFaqDocuments).where(eq(kioskFaqDocuments.domainId, domainId)).orderBy(desc(kioskFaqDocuments.uploadedAt));
  }

  async getKioskFaqDocument(id: string): Promise<KioskFaqDocument | undefined> {
    const result = await db.select().from(kioskFaqDocuments).where(eq(kioskFaqDocuments.id, id));
    return result[0];
  }

  async createKioskFaqDocument(doc: InsertKioskFaqDocument): Promise<KioskFaqDocument> {
    const result = await db.insert(kioskFaqDocuments).values(doc).returning();
    return result[0];
  }

  async updateKioskFaqDocumentStatus(id: string, status: string): Promise<KioskFaqDocument | undefined> {
    const result = await db.update(kioskFaqDocuments).set({ status }).where(eq(kioskFaqDocuments.id, id)).returning();
    return result[0];
  }

  async deleteKioskFaqDocument(id: string): Promise<void> {
    await db.delete(kioskFaqDocuments).where(eq(kioskFaqDocuments.id, id));
  }

  // Kiosk FAQ Entry methods
  async getKioskFaqEntries(domainId: string): Promise<KioskFaqEntry[]> {
    return db.select().from(kioskFaqEntries).where(eq(kioskFaqEntries.domainId, domainId)).orderBy(asc(kioskFaqEntries.billingCategory));
  }

  async getKioskFaqEntriesByDocument(documentId: string): Promise<KioskFaqEntry[]> {
    return db.select().from(kioskFaqEntries).where(eq(kioskFaqEntries.documentId, documentId));
  }

  async createKioskFaqEntry(entry: InsertKioskFaqEntry): Promise<KioskFaqEntry> {
    const result = await db.insert(kioskFaqEntries).values(entry).returning();
    return result[0];
  }

  async createKioskFaqEntriesBulk(entries: InsertKioskFaqEntry[]): Promise<KioskFaqEntry[]> {
    if (entries.length === 0) return [];
    const result = await db.insert(kioskFaqEntries).values(entries).returning();
    return result;
  }

  async deleteKioskFaqEntriesByDocument(documentId: string): Promise<void> {
    await db.delete(kioskFaqEntries).where(eq(kioskFaqEntries.documentId, documentId));
  }

  // Kiosk Chat methods
  async getKioskChats(userId: string, domainId: string): Promise<KioskChat[]> {
    return db.select().from(kioskChats).where(and(eq(kioskChats.userId, userId), eq(kioskChats.domainId, domainId))).orderBy(desc(kioskChats.createdAt));
  }

  async getKioskChat(id: string): Promise<KioskChat | undefined> {
    const result = await db.select().from(kioskChats).where(eq(kioskChats.id, id));
    return result[0];
  }

  async createKioskChat(chat: InsertKioskChat): Promise<KioskChat> {
    const result = await db.insert(kioskChats).values(chat).returning();
    return result[0];
  }

  async deleteKioskChat(id: string): Promise<void> {
    await db.delete(kioskChats).where(eq(kioskChats.id, id));
  }

  async updateKioskChatTitle(id: string, title: string): Promise<KioskChat | undefined> {
    const result = await db.update(kioskChats).set({ title }).where(eq(kioskChats.id, id)).returning();
    return result[0];
  }

  // Kiosk Message methods
  async getKioskMessages(chatId: string): Promise<KioskMessage[]> {
    return db.select().from(kioskMessages).where(eq(kioskMessages.chatId, chatId)).orderBy(asc(kioskMessages.createdAt));
  }

  async createKioskMessage(message: InsertKioskMessage): Promise<KioskMessage> {
    const result = await db.insert(kioskMessages).values(message).returning();
    return result[0];
  }

  // Domain API Connectors methods
  async getDomainApiConnectors(domainId: string): Promise<DomainApiConnector[]> {
    return db.select().from(domainApiConnectors).where(eq(domainApiConnectors.domainId, domainId)).orderBy(asc(domainApiConnectors.name));
  }

  async getDomainApiConnector(domainId: string, connectorType: string): Promise<DomainApiConnector | undefined> {
    const result = await db.select().from(domainApiConnectors).where(
      and(eq(domainApiConnectors.domainId, domainId), eq(domainApiConnectors.connectorType, connectorType))
    );
    return result[0];
  }

  async getDomainApiConnectorById(id: string): Promise<DomainApiConnector | undefined> {
    const result = await db.select().from(domainApiConnectors).where(eq(domainApiConnectors.id, id));
    return result[0];
  }

  async getEnabledDomainApiConnectors(domainId: string): Promise<DomainApiConnector[]> {
    return db.select().from(domainApiConnectors).where(
      and(eq(domainApiConnectors.domainId, domainId), eq(domainApiConnectors.enabled, 1))
    );
  }

  async createDomainApiConnector(connector: InsertDomainApiConnector): Promise<DomainApiConnector> {
    const result = await db.insert(domainApiConnectors).values(connector).returning();
    return result[0];
  }

  async updateDomainApiConnector(id: string, updates: Partial<InsertDomainApiConnector>): Promise<DomainApiConnector | undefined> {
    const result = await db.update(domainApiConnectors).set({
      ...updates,
      updatedAt: new Date(),
    }).where(eq(domainApiConnectors.id, id)).returning();
    return result[0];
  }

  async deleteDomainApiConnector(id: string): Promise<void> {
    await db.delete(domainApiConnectors).where(eq(domainApiConnectors.id, id));
  }

  async updateDomainApiConnectorStatus(id: string, status: string, syncResult?: string, documentCount?: number): Promise<void> {
    await db.update(domainApiConnectors).set({
      status,
      lastSyncAt: new Date(),
      lastSyncResult: syncResult,
      documentCount: documentCount ?? undefined,
      updatedAt: new Date(),
    }).where(eq(domainApiConnectors.id, id));
  }

  // Azure Blob File Registry — delta-sync tracking
  async getBlobRegistryForConnector(connectorId: string): Promise<Map<string, AzureBlobFileRegistry>> {
    const rows = await db.select().from(azureBlobFileRegistry)
      .where(eq(azureBlobFileRegistry.connectorId, connectorId));
    const map = new Map<string, AzureBlobFileRegistry>();
    for (const row of rows) {
      map.set(row.blobName, row);
    }
    return map;
  }

  async upsertBlobRegistryEntry(data: {
    connectorId: string;
    blobName: string;
    etag: string;
    lastModified?: Date;
    documentId?: string;
    jobId?: string;
    status: string;
  }): Promise<AzureBlobFileRegistry> {
    const result = await db.insert(azureBlobFileRegistry).values({
      connectorId: data.connectorId,
      blobName: data.blobName,
      etag: data.etag,
      lastModified: data.lastModified,
      documentId: data.documentId,
      jobId: data.jobId,
      status: data.status,
      ingestedAt: new Date(),
    }).onConflictDoUpdate({
      target: [azureBlobFileRegistry.connectorId, azureBlobFileRegistry.blobName],
      set: {
        etag: data.etag,
        lastModified: data.lastModified,
        documentId: data.documentId,
        jobId: data.jobId,
        status: data.status,
        ingestedAt: new Date(),
      },
    }).returning();
    return result[0];
  }

  // Cube methods for data segregation
  async getCubes(domainId: string): Promise<Cube[]> {
    return db.select().from(cubes).where(eq(cubes.domainId, domainId)).orderBy(asc(cubes.name));
  }

  async getCube(id: string): Promise<Cube | undefined> {
    const result = await db.select().from(cubes).where(eq(cubes.id, id));
    return result[0];
  }

  async getCubeByName(domainId: string, name: string): Promise<Cube | undefined> {
    const result = await db.select().from(cubes).where(
      and(eq(cubes.domainId, domainId), eq(cubes.name, name))
    );
    return result[0];
  }

  async createCube(cube: InsertCube): Promise<Cube> {
    const result = await db.insert(cubes).values(cube).returning();
    return result[0];
  }

  async updateCube(id: string, updates: Partial<InsertCube>): Promise<Cube | undefined> {
    const result = await db.update(cubes).set(updates).where(eq(cubes.id, id)).returning();
    return result[0];
  }

  async deleteCube(id: string): Promise<void> {
    // Delete all related data before deleting the cube itself
    console.log(`Deleting cube ${id} and all related data...`);
    
    // 1. Delete cube_fact_data (semantic SQL data)
    await db.execute(sqlOp`DELETE FROM cube_fact_data WHERE cube_id = ${id}`);
    console.log(`  - Deleted cube_fact_data`);
    
    // 2. Delete cube_dimensions - also can be large
    await db.execute(sqlOp`DELETE FROM cube_dimensions WHERE cube_id = ${id}`);
    console.log(`  - Deleted cube_dimensions`);
    
    // 3. Delete enterprise_document_chunks for this cube
    await db.execute(sqlOp`DELETE FROM enterprise_document_chunks WHERE cube_id = ${id}`);
    console.log(`  - Deleted enterprise_document_chunks`);
    
    // 4. Delete enterprise_document_embeddings for this cube
    await db.execute(sqlOp`DELETE FROM enterprise_document_embeddings WHERE cube_id = ${id}`);
    console.log(`  - Deleted enterprise_document_embeddings`);
    
    // 5. Delete enterprise_documents for this cube
    await db.execute(sqlOp`DELETE FROM enterprise_documents WHERE cube_id = ${id}`);
    console.log(`  - Deleted enterprise_documents`);
    
    // 6. Delete cube_metadata
    await db.execute(sqlOp`DELETE FROM cube_metadata WHERE cube_id = ${id}`);
    console.log(`  - Deleted cube_metadata`);
    
    // 7. Delete cube_user_access
    await db.delete(cubeUserAccess).where(eq(cubeUserAccess.cubeId, id));
    console.log(`  - Deleted cube_user_access`);
    
    // 8. Delete cube_business_terms
    await db.execute(sqlOp`DELETE FROM cube_business_terms WHERE cube_id = ${id}`);
    console.log(`  - Deleted cube_business_terms`);
    
    // 9. Delete cube_calculation_rules
    await db.execute(sqlOp`DELETE FROM cube_calculation_rules WHERE cube_id = ${id}`);
    console.log(`  - Deleted cube_calculation_rules`);
    
    // 10. Delete cube_filter_rules
    await db.execute(sqlOp`DELETE FROM cube_filter_rules WHERE cube_id = ${id}`);
    console.log(`  - Deleted cube_filter_rules`);
    
    // 11. Delete cube_query_patterns
    await db.execute(sqlOp`DELETE FROM cube_query_patterns WHERE cube_id = ${id}`);
    console.log(`  - Deleted cube_query_patterns`);
    
    // 12. Delete cube_column_values
    await db.execute(sqlOp`DELETE FROM cube_column_values WHERE cube_id = ${id}`);
    console.log(`  - Deleted cube_column_values`);
    
    // 13. Delete cube_column_config
    await db.execute(sqlOp`DELETE FROM cube_column_config WHERE cube_id = ${id}`);
    console.log(`  - Deleted cube_column_config`);
    
    // 14. Delete cube_ingestion_jobs
    await db.execute(sqlOp`DELETE FROM cube_ingestion_jobs WHERE cube_id = ${id}`);
    console.log(`  - Deleted cube_ingestion_jobs`);

    // 15. Delete linked data source connectors so their schedules are fully removed
    await db.execute(sqlOp`DELETE FROM domain_api_connectors WHERE target_cube_id = ${id}`);
    console.log(`  - Deleted domain_api_connectors`);
    
    // Finally, delete the cube record itself
    await db.delete(cubes).where(eq(cubes.id, id));
    console.log(`  - Deleted cube record`);
    
    console.log(`Cube ${id} and all related data deleted successfully`);
  }

  async getCubeDocumentCount(cubeId: string): Promise<number> {
    const result = await db.select({ count: count() }).from(enterpriseDocuments).where(eq(enterpriseDocuments.cubeId, cubeId));
    return result[0]?.count || 0;
  }

  // Cube user access methods
  async getCubeUserAccess(cubeId: string): Promise<CubeUserAccess[]> {
    return db.select().from(cubeUserAccess).where(eq(cubeUserAccess.cubeId, cubeId)).orderBy(asc(cubeUserAccess.userEmail));
  }

  async getUserCubeAccess(userEmail: string, domainId: string): Promise<CubeUserAccess[]> {
    const domainCubes = await this.getCubes(domainId);
    const cubeIds = domainCubes.map(c => c.id);
    if (cubeIds.length === 0) return [];
    
    const results = await db.select().from(cubeUserAccess).where(
      and(
        eq(cubeUserAccess.userEmail, userEmail.toLowerCase()),
        sqlOp`${cubeUserAccess.cubeId} = ANY(${cubeIds})`
      )
    );
    return results;
  }

  async getCubeAccessForUser(cubeId: string, userEmail: string): Promise<CubeUserAccess | undefined> {
    const result = await db.select().from(cubeUserAccess).where(
      and(eq(cubeUserAccess.cubeId, cubeId), eq(cubeUserAccess.userEmail, userEmail.toLowerCase()))
    );
    return result[0];
  }

  async grantCubeAccess(access: InsertCubeUserAccess): Promise<CubeUserAccess> {
    const result = await db.insert(cubeUserAccess).values({
      ...access,
      userEmail: access.userEmail.toLowerCase(),
    }).returning();
    return result[0];
  }

  async updateCubeAccess(id: string, enabled: number): Promise<CubeUserAccess | undefined> {
    const result = await db.update(cubeUserAccess).set({ enabled }).where(eq(cubeUserAccess.id, id)).returning();
    return result[0];
  }

  async revokeCubeAccess(cubeId: string, userEmail: string): Promise<void> {
    await db.delete(cubeUserAccess).where(
      and(eq(cubeUserAccess.cubeId, cubeId), eq(cubeUserAccess.userEmail, userEmail.toLowerCase()))
    );
  }

  async getAccessibleCubeIds(userEmail: string, domainId: string): Promise<string[]> {
    const domainCubes = await this.getCubes(domainId);
    const cubeIds = domainCubes.map(c => c.id);
    if (cubeIds.length === 0) return [];

    const accessRecords = await db.select({ cubeId: cubeUserAccess.cubeId }).from(cubeUserAccess).where(
      and(
        eq(cubeUserAccess.userEmail, userEmail.toLowerCase()),
        eq(cubeUserAccess.enabled, 1),
        inArray(cubeUserAccess.cubeId, cubeIds)
      )
    );
    return accessRecords.map(r => r.cubeId);
  }

  // Cube metadata methods for structured data indexing
  async getCubeMetadata(cubeId: string): Promise<CubeMetadata | undefined> {
    const result = await db.select().from(cubeMetadata).where(eq(cubeMetadata.cubeId, cubeId));
    return result[0];
  }

  async upsertCubeMetadata(metadata: InsertCubeMetadata): Promise<CubeMetadata> {
    const existing = await this.getCubeMetadata(metadata.cubeId);
    if (existing) {
      const result = await db.update(cubeMetadata).set({
        ...metadata,
        updatedAt: new Date(),
      }).where(eq(cubeMetadata.cubeId, metadata.cubeId)).returning();
      return result[0];
    } else {
      const result = await db.insert(cubeMetadata).values(metadata).returning();
      return result[0];
    }
  }

  async deleteCubeMetadata(cubeId: string): Promise<void> {
    await db.delete(cubeMetadata).where(eq(cubeMetadata.cubeId, cubeId));
  }
}

export const storage = new DbStorage();
