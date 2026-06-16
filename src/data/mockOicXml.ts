export interface OicXmlTemplate {
  id: string;
  name: string;
  fileName: string;
  description: string;
  style: "Scheduled Orchestration" | "App-Driven Orchestration";
  xml: string;
}

export const mockOicTemplates: OicXmlTemplate[] = [
  {
    id: "sf-ns-sync",
    name: "Salesforce CRM Opportunities to NetSuite Invoice Sync",
    fileName: "SF_CRM_Opportunities_To_NetSuite_Invoice_Sync_01.00.xml",
    description: "Scheduled flow that queries closed-won opportunities from Salesforce, maps payload fields to NetSuite Custom Invoice types, processes line-items via For-Each loop, and handles ERP system availability faults.",
    style: "Scheduled Orchestration",
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<icspackage xmlns="http://www.oracle.com/ics/package" xmlns:oracle-ics="http://www.oracle.com/ics" id="SF_CRM_OPPOR_NS_INV_SYNC" version="01.00.0000">
  <project>
    <orchestration style="scheduled">
      <id>PROCESS_SALES_OPPORTUNITIES</id>
      <name>Salesforce Opportunity to NetSuite Invoice Pipeline</name>
      <version>1.0</version>
      <description>Automated pipeline for synchronizing high-value closed-won opportunities to ERP financial invoices.</description>
      
      <partnerLinks>
        <partnerLink name="Salesforce_Connector" adapterId="salesforce" role="trigger">
          <description>Enterprise CRM Trigger Connection</description>
          <property name="connectionName">Salesforce_US_Production</property>
          <property name="operation">queryOpportunities</property>
          <property name="query">SELECT Id, Name, AccountId, Amount, CloseDate, (SELECT PricebookEntryId, Quantity, UnitPrice FROM OpportunityLineItems) FROM Opportunity WHERE StageName = 'Closed Won' AND Synced_To_NetSuite__c = false</property>
        </partnerLink>
        
        <partnerLink name="NetSuite_ERP_Service" adapterId="netsuite" role="invoke">
          <description>ERP System Financial Invoke</description>
          <property name="connectionName">NetSuite_Finance_EMEA</property>
          <property name="operation">createInvoice</property>
          <property name="wsdlLocation">NetSuiteService.wsdl</property>
        </partnerLink>

        <partnerLink name="Notification_System" adapterId="notification" role="invoke">
          <property name="connectionName">Slack_Notification_Workspace</property>
          <property name="channel">#finance-sync-alerts</property>
        </partnerLink>
      </partnerLinks>

      <variables>
        <variable name="salesforceQueryResponse" type="OpportunityCollection"/>
        <variable name="netsuiteInvoicePayload" type="InvoiceRequest"/>
        <variable name="netsuiteInvoiceResponse" type="InvoiceResponse"/>
        <variable name="currentOpportunity" type="Opportunity"/>
        <variable name="errorVariable" type="FaultMessage"/>
      </variables>

      <flow>
        <!-- A. Schedule Recurrence Trigger -->
        <scheduleRecurrence trigger="daily" time="23:00:00-07:00">
          <description>Runs every evening at 11 PM UTC</description>
        </scheduleRecurrence>

        <sequence name="Main_Processing_Loop">
          <!-- B. Call Salesforce to query opportunities -->
          <invoke name="Query_Closed_Won_Opportunities" partnerLink="Salesforce_Connector" operation="queryOpportunities">
            <output variable="salesforceQueryResponse"/>
          </invoke>

          <!-- C. Loop over returned Opportunities -->
          <forEach name="For_Each_Synced_Opportunity" variable="currentOpportunity" select="$salesforceQueryResponse/Opportunities">
            <scope name="Process_Single_Transaction">
              <faultHandlers>
                <catch faultName="NetSuiteConnectionException" variable="errorVariable">
                  <sequence>
                    <!-- Post failure notification to Slack -->
                    <assign name="Map_Slack_Error_Notification">
                      <copy>
                        <from>concat("CRITICAL: Failed to push Invoice to NetSuite for Salesforce Opportunity ID: ", $currentOpportunity/Id, ". Fault Reason: ", $errorVariable/Reason)</from>
                        <to>$slackAlert/message</to>
                      </copy>
                    </assign>
                    <invoke name="Notify_Slack_Of_Fault" partnerLink="Notification_System" operation="postMessage"/>
                  </sequence>
                </catch>
              </faultHandlers>

              <sequence name="Mapping_and_Dispatch">
                <!-- D. Transform CRM schema to NetSuite SOAP invoice structure -->
                <assign name="Transform_CRM_to_ERP_Invoice">
                  <copy>
                    <from>$currentOpportunity/AccountId</from>
                    <to>$netsuiteInvoicePayload/invoiceHeader/entityId</to>
                  </copy>
                  <copy>
                    <from>$currentOpportunity/CloseDate</from>
                    <to>$netsuiteInvoicePayload/invoiceHeader/transactionDate</to>
                  </copy>
                  <copy>
                    <from>concat("OIC-REF-SF-", $currentOpportunity/Id)</from>
                    <to>$netsuiteInvoicePayload/invoiceHeader/otherReferenceNumber</to>
                  </copy>
                  
                  <!-- Inside loop, map products / line-items using custom XSLT expression -->
                  <copy>
                    <from>
                      <xsl:for-each select="$currentOpportunity/OpportunityLineItems">
                        <item>
                          <itemId><xsl:value-of select="PricebookEntryId"/></itemId>
                          <quantity><xsl:value-of select="Quantity"/></quantity>
                          <rate><xsl:value-of select="UnitPrice"/></rate>
                          <taxCode>US_TAX_EXEMPT</taxCode>
                        </item>
                      </xsl:for-each>
                    </from>
                    <to>$netsuiteInvoicePayload/invoiceItems/itemList</to>
                  </copy>
                </assign>

                <!-- E. Invoke NetSuite API to generate transaction -->
                <invoke name="Publish_NetSuite_Invoice" partnerLink="NetSuite_ERP_Service" operation="createInvoice">
                  <input variable="netsuiteInvoicePayload"/>
                  <output variable="netsuiteInvoiceResponse"/>
                </invoke>
                
                <!-- F. Update Synced Status back to Salesforce -->
                <assign name="Prepare_SF_Sync_Status">
                  <copy>
                    <from>true</from>
                    <to>$currentOpportunity/Synced_To_NetSuite__c</to>
                  </copy>
                </assign>
                <invoke name="Update_Salesforce_Synch_Flag" partnerLink="Salesforce_Connector" operation="updateOpportunites"/>
              </sequence>
            </scope>
          </forEach>
        </sequence>
      </flow>
    </orchestration>
  </project>
</icspackage>`
  },
  {
    id: "wd-ad-provisioning",
    name: "Workday HR Employee Onboarding to Active Directory Provisioning",
    fileName: "WD_Active_Directory_Employee_Provisioner_02.10.xml",
    description: "App-Driven integration triggered via a HR webhook. It retrieves candidate status, generates standard domain username/emails via XSLT rules, and invokes LDAP AD services to provision enterprise accounts.",
    style: "App-Driven Orchestration",
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<icspackage xmlns="http://www.oracle.com/ics/package" id="HR_WORKDAY_AD_EMP_PROVISION" version="02.10.0000">
  <project>
    <orchestration style="appDriven">
      <id>PROVISION_ACTIVE_DIRECTORY_USER</id>
      <name>Workday HR Onboarding Webhook Listener</name>
      <version>2.1</version>
      <description>Realtime App-Driven process triggered by HR Workday Hire Event. Provisions Active Directory access.</description>
      
      <partnerLinks>
        <partnerLink name="Workday_Registration_Webhook" adapterId="REST" role="trigger">
          <description>OAuth2 secured JSON Hook Endpoint</description>
          <property name="connectionName">Workday_HCM_Cloud</property>
          <property name="resourcePath">/employees/newHire</property>
          <property name="httpMethod">POST</property>
        </partnerLink>
        
        <partnerLink name="Active_Directory_LDAP" adapterId="ActiveDirectory" role="invoke">
          <description>Enterprise LDAP Directory Service Endpoint</description>
          <property name="connectionName">AD_LDAP_Gateway_OnPremise</property>
          <property name="operation">createUserObject</property>
        </partnerLink>

        <partnerLink name="Mail_Service" adapterId="SMTP" role="invoke">
          <property name="connectionName">OIC_Notification_SMTP</property>
          <property name="email_host">smtp.oraclecloud.com</property>
        </partnerLink>
      </partnerLinks>

      <variables>
        <variable name="webhookNewHireRequest" type="EmployeeJSON"/>
        <variable name="ldapUserCreatePayload" type="LDAPCreateUser"/>
        <variable name="ldapResponse" type="LDAPResponse"/>
        <variable name="emailPayload" type="SMTPBody"/>
      </variables>

      <flow>
        <receive partnerLink="Workday_Registration_Webhook" operation="newHire">
          <input variable="webhookNewHireRequest"/>
        </receive>

        <sequence name="Provisioning_Service_Steps">
          <switch name="Evaluate_Employment_Type">
            <case expression="$webhookNewHireRequest/employmentType = 'FullTime' or $webhookNewHireRequest/employmentType = 'Contractor'">
              <sequence name="Provision_AD_Account">
                <!-- A. Transform Workday schema to LDAP Directory structure with String Manipulation -->
                <assign name="Transform_HCM_To_LDAP_Schema">
                  <copy>
                    <from>concat($webhookNewHireRequest/firstName, " ", $webhookNewHireRequest/lastName)</from>
                    <to>$ldapUserCreatePayload/commonName</to>
                  </copy>
                  <copy>
                    <from>
                      <!-- Generates lowercased u_first.last@corporation.com -->
                      lower-case(concat("u_", substring($webhookNewHireRequest/firstName, 1, 1), $webhookNewHireRequest/lastName, "@enterprise-cloud.org"))
                    </from>
                    <to>$ldapUserCreatePayload/userPrincipalName</to>
                  </copy>
                  <copy>
                    <from>concat("OU=", $webhookNewHireRequest/departmentName, ",OU=Employees,DC=enterprise-cloud,DC=org")</from>
                    <to>$ldapUserCreatePayload/distinguishedName</to>
                  </copy>
                  <copy>
                    <from>$webhookNewHireRequest/employeeId</from>
                    <to>$ldapUserCreatePayload/employeeNumber</to>
                  </copy>
                </assign>

                <!-- B. Invoke On-Premises AD LDAP Gateway -->
                <invoke name="Create_User_In_LDAP" partnerLink="Active_Directory_LDAP" operation="createUserObject">
                  <input variable="ldapUserCreatePayload"/>
                  <output variable="ldapResponse"/>
                </invoke>

                <!-- C. SMTP Email Trigger containing credentials to supervisor -->
                <assign name="Compile_Onboard_Email">
                  <copy>
                    <from>$webhookNewHireRequest/managerEmail</from>
                    <to>$emailPayload/to</to>
                  </copy>
                  <copy>
                    <from>concat("Enterprise Identity Created: ", $webhookNewHireRequest/firstName, " ", $webhookNewHireRequest/lastName)</from>
                    <to>$emailPayload/subject</to>
                  </copy>
                  <copy>
                    <from>
                      concat("Hello,\\n\\nThe LDAP credentials have been successfully provisioned for: ", 
                      $webhookNewHireRequest/firstName, " ", $webhookNewHireRequest/lastName, 
                      "\\nGenerated UPN Account: ", $ldapUserCreatePayload/userPrincipalName, 
                      "\\nActive Directory Status: Provisioned successfully under local VCN Gateway.")
                    </from>
                    <to>$emailPayload/body</to>
                  </copy>
                </assign>

                <invoke name="Email_Supervisor_Credentials" partnerLink="Mail_Service" operation="sendMail"/>
              </sequence>
            </case>
            <default>
              <!-- Ignore other profiles like external consultants -->
              <sequence name="Logger_Omission">
                <!-- Mock logger steps -->
              </sequence>
            </default>
          </switch>
        </sequence>
      </flow>
    </orchestration>
  </project>
</icspackage>`
  },
  {
    id: "s3-bulk-db",
    name: "Enterprise Bulk S3 Event File Parser and DB Relational Ingestion",
    fileName: "Bulk_S3_Ecom_Trans_Loader_03.00.xml",
    description: "High-volume bulk processing integration. It downloads file payloads triggered by AWS S3 events, dissects bulk CSV trans line-by-line, runs DB batches to update MySQL registers, and cleans archives.",
    style: "Scheduled Orchestration",
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<icspackage xmlns="http://www.oracle.com/ics/package" id="BULK_S3_ECOMMERCE_DB_LOADER" version="03.00.0000">
  <project>
    <orchestration style="scheduled">
      <id>PROCESS_BULK_STORE_SALES</id>
      <name>S3 Sales Bulk CSV Ingestion</name>
      <version>3.0</version>
      <description>Processes bulk nightly store ledger files. Downloads CSV payload, maps structure database arrays, and invokes fast SQL batch commits.</description>
      
      <partnerLinks>
        <partnerLink name="AWS_S3_FileStore" adapterId="AWSS3" role="trigger">
          <description>AWS Cloud Storage Adapter</description>
          <property name="connectionName">AWS_S3_SettleStore</property>
          <property name="bucket">ecommerce-nightly-sales</property>
        </partnerLink>
        
        <partnerLink name="MySQL_Warehouse" adapterId="MySQL" role="invoke">
          <description>Relational DB Transaction Warehouse</description>
          <property name="connectionName">Oracle_Autonomous_Transaction_Processing</property>
          <property name="schema">SALES_DW</property>
        </partnerLink>

        <partnerLink name="Diagnostic_Reporter" adapterId="LocalLogging" role="invoke">
          <property name="logProfile">OIC_Diagnostic_Default</property>
        </partnerLink>
      </partnerLinks>

      <variables>
        <variable name="s3DownloadResponse" type="FileAttachment"/>
        <variable name="dbBatchInsertRequest" type="StoreSalesRowSet"/>
        <variable name="bulkLineCount" type="xsd:integer"/>
      </variables>

      <flow>
        <scheduleRecurrence trigger="every_hour"/>

        <sequence name="Bulk_Execution_Thread">
          <!-- A. Download File contents from storage -->
          <invoke name="Download_CSV_From_S3" partnerLink="AWS_S3_FileStore" operation="getObject">
            <output variable="s3DownloadResponse"/>
          </invoke>

          <!-- B. Call Diagnostic Logger before parse -->
          <invoke name="Log_Inbound_Batch_Metadata" partnerLink="Diagnostic_Reporter" operation="writeAuditLog"/>

          <!-- C. Fast CSV Parser iteration loop -->
          <forEach name="Scan_CSV_Rows_And_Compile_Data" select="$s3DownloadResponse/fileRows" variable="currentRow">
            <scope name="Row_Compilation">
              <sequence>
                <!-- Build dynamic array payload of SQL row bindings -->
                <assign name="Compile_SQL_Bind_Structures">
                  <copy>
                    <from>$currentRow/columns[1]</from>
                    <to>$dbBatchInsertRequest/row/transactionId</to>
                  </copy>
                  <copy>
                    <from>$currentRow/columns[2]</from>
                    <to>$dbBatchInsertRequest/row/skuCode</to>
                  </copy>
                  <copy>
                    <from>number($currentRow/columns[3])</from>
                    <to>$dbBatchInsertRequest/row/grossAmount</to>
                  </copy>
                </assign>
              </sequence>
            </scope>
          </forEach>

          <!-- D. Bulk insert arrays in a single relational context call -->
          <invoke name="Inbound_Trans_Batch_Commit" partnerLink="MySQL_Warehouse" operation="insertBatchStoreSales">
            <input variable="dbBatchInsertRequest"/>
          </invoke>
        </sequence>
      </flow>
    </orchestration>
  </project>
</icspackage>`
  }
];
