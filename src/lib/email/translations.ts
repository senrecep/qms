// Standalone email translation dictionary
// Used in worker process where next-intl useTranslations() is unavailable

export type EmailLocale = "tr" | "en";

function interpolate(
  template: string,
  params: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, key) =>
    key in params ? String(params[key]) : `{${key}}`,
  );
}

export function resolveSubject(
  locale: EmailLocale,
  key: string,
  params?: Record<string, string | number>,
): string {
  const template = emailStrings[locale].subjects[key];
  if (!template) {
    console.warn(`[Email i18n] Missing subject key: ${key} for locale: ${locale}`);
    return key;
  }
  return params ? interpolate(template, params) : template;
}

export const emailStrings: Record<
  EmailLocale,
  {
    common: {
      footer: string;
      greeting: string;
    };
    subjects: Record<string, string>;
    approvalRequest: {
      preview: string;
      heading: string;
      preparerBody: string;
      approverBody: string;
      documentCodeLabel: string;
      button: string;
    };
    preparerApproved: {
      preview: string;
      heading: string;
      body: string;
      documentCodeLabel: string;
      button: string;
    };
    approvalReminder: {
      preview: string;
      heading: string;
      body: string;
      warning: string;
      button: string;
    };
    documentApproved: {
      preview: string;
      heading: string;
      body: string;
      info: string;
      button: string;
    };
    documentRejected: {
      preview: string;
      heading: string;
      body: string;
      reasonLabel: string;
      afterReason: string;
      button: string;
      rejectedByPreparer: string;
      rejectedByApprover: string;
    };
    documentRevised: {
      preview: string;
      heading: string;
      body: string;
      revisionLabel: string;
      notesLabel: string;
      info: string;
      button: string;
    };
    documentCancelled: {
      preview: string;
      heading: string;
      body: string;
      warning: string;
    };
    readAssignment: {
      preview: string;
      heading: string;
      body: string;
      info: string;
      button: string;
    };
    documentDistributed: {
      preview: string;
      heading: string;
      body: string;
      info: string;
      button: string;
    };
    readReminder: {
      preview: string;
      heading: string;
      body: string;
      warning: string;
      button: string;
    };
    escalationNotice: {
      preview: string;
      heading: string;
      body: string;
      reasonLabel: string;
      reasonText: string;
      afterReason: string;
      button: string;
    };
    welcome: {
      preview: string;
      heading: string;
      body: string;
      info: string;
      button: string;
    };
    testEmail: {
      body: string;
    };
  }
> = {
  tr: {
    common: {
      footer:
        "Bu e-posta DMS (Document Management System) tarafından otomatik olarak gönderilmiştir.",
      greeting: "Merhaba {name},",
    },
    subjects: {
      approvalRequest: "Onay Talebi: {title}",
      preparerApprovalRequest: "Hazırlayıcı Onay Talebi: {title}",
      approverApprovalRequest: "Nihai Onay Talebi: {title}",
      preparerApproved: "Hazırlayıcı Onayı Tamamlandı: {title}",
      documentApproved: "Belge Onaylandı: {title}",
      documentRejected: "Belge Reddedildi: {title}",
      documentCancelled: "Belge İptal Edildi: {title}",
      documentRevised: "Belge Revize Edildi: {title}",
      readAssignment: "Okuma Görevi: {title}",
      documentDistributed: "Belge Bilgilendirmesi: {title}",
      approvalReminder: "Hatırlatma: {title} onay bekliyor",
      readReminder: "Hatırlatma: {title} okuma onayı bekliyor",
      escalation: "Eskalasyon: {title}",
      welcome: "DMS - Parolanızı Belirleyin",
      testEmail: "DMS - Test Email",
    },
    approvalRequest: {
      preview: "Onay Talebi: {title}",
      heading: "Onay Talebi",
      preparerBody: "{uploaderName} tarafından gönderilen {documentTitle} belgesi hazırlayıcı olarak onayınızı beklemektedir. Lütfen belgeyi inceleyin ve onaylayın.",
      approverBody: "{documentTitle} belgesi hazırlayıcı tarafından onaylanmıştır. Nihai onay için lütfen belgeyi inceleyin.",
      documentCodeLabel: "Belge Kodu",
      button: "Belgeyi İncele",
    },
    preparerApproved: {
      preview: "Hazırlayıcı Onayı: {title}",
      heading: "Hazırlayıcı Onayı Tamamlandı",
      body: "{preparerName} tarafından {documentTitle} ({documentCode}) belgesi hazırlayıcı olarak onaylanmıştır. Nihai onay için lütfen belgeyi inceleyin.",
      documentCodeLabel: "Belge Kodu",
      button: "Belgeyi İncele ve Onayla",
    },
    approvalReminder: {
      preview: "Hatırlatma: {title} onay bekliyor",
      heading: "Onay Hatırlatması",
      body: "{documentTitle} ({documentCode}) belgesi {daysPending} gündür onayınızı beklemektedir.",
      warning: "Lütfen belgeyi en kısa sürede inceleyiniz.",
      button: "Belgeyi İncele",
    },
    documentApproved: {
      preview: "Onaylandı: {title}",
      heading: "Belge Onaylandı",
      body: "{documentTitle} ({documentCode}) belgesi {approvedBy} tarafından onaylanmıştır.",
      info: "Artık belgenizi yayınlayabilirsiniz.",
      button: "Belgeyi Yayınla",
    },
    documentRejected: {
      preview: "Reddedildi: {title}",
      heading: "Belge Reddedildi",
      body: "{documentTitle} ({documentCode}) belgesi {rejectedBy} tarafından reddedilmiştir.",
      reasonLabel: "Red Nedeni:",
      afterReason:
        "Belgeyi düzenleyip tekrar onaya gönderebilirsiniz.",
      button: "Belgeyi Düzenle",
      rejectedByPreparer: "Hazırlayıcı",
      rejectedByApprover: "Onaylayıcı",
    },
    documentRevised: {
      preview: "Revize Edildi: {title}",
      heading: "Belge Revize Edildi",
      body: "{documentTitle} ({documentCode}) belgesi {revisedBy} tarafından revize edilmiştir.",
      revisionLabel: "Revizyon Numarası:",
      notesLabel: "Revizyon Notları:",
      info: "Yeni versiyon incelemenizi beklemektedir.",
      button: "Belgeyi Görüntüle",
    },
    documentCancelled: {
      preview: "İptal Edildi: {title}",
      heading: "Belge İptal Edildi",
      body: "{documentTitle} ({documentCode}) belgesi {cancelledBy} tarafından iptal edilmiştir.",
      warning: "Bu belge artık geçersizdir ve kullanılmamalıdır.",
    },
    readAssignment: {
      preview: "Okuma Görevi: {title}",
      heading: "Okuma Görevi",
      body: "{publishedBy} tarafından yayınlanan {documentTitle} ({documentCode}) belgesini okumanız gerekmektedir.",
      info: "Belgeyi okuduktan sonra onay vermeniz gerekmektedir.",
      button: "Belgeyi Oku",
    },
    documentDistributed: {
      preview: "Belge Dağıtımı: {title}",
      heading: "Belge Bilgilendirmesi",
      body: "{publishedBy} tarafından yayınlanan {documentTitle} ({documentCode}) belgesi bilginize sunulmuştur.",
      info: "Bu belge bilgilendirme amaçlı tarafınıza iletilmiştir.",
      button: "Belgeyi Görüntüle",
    },
    readReminder: {
      preview: "Hatırlatma: {title} okuma onayı bekliyor",
      heading: "Okuma Hatırlatması",
      body: "{documentTitle} ({documentCode}) belgesini {daysPending} gündür okumadınız veya onaylamadınız.",
      warning: "Lütfen belgeyi en kısa sürede okuyup onaylayınız.",
      button: "Belgeyi Oku ve Onayla",
    },
    escalationNotice: {
      preview: "Eskalasyon: {title}",
      heading: "Eskalasyon Bildirimi",
      body: "{documentTitle} ({documentCode}) belgesi {originalApprover} tarafından {daysPending} gündür onaylanmamıştır. Belge onayınız için size yönlendirilmiştir.",
      reasonLabel: "Eskalasyon Nedeni",
      reasonText:
        "Orijinal onaylayıcı {originalApprover} belirtilen süre içinde onay vermemiştir. Belge {daysPending} gündür beklemektedir.",
      afterReason:
        "Lütfen belgeyi inceleyip gerekli aksiyonu alınız.",
      button: "Belgeyi İncele",
    },
    welcome: {
      preview: "DMS'e Hoşgeldiniz",
      heading: "Hoşgeldiniz!",
      body: "Merhaba {userName}, DMS (Document Management System) hesabınız oluşturulmuştur. Aşağıdaki butona tıklayarak parolanızı belirleyebilirsiniz.",
      info: "Bu link 24 saat geçerlidir. Süresi dolduğunda yeni link talep edebilirsiniz.",
      button: "Parolamı Belirle",
    },
    testEmail: {
      body: "Bu bir test emailidir. Email ayarlarınız doğru şekilde yapılandırılmıştır.",
    },
  },
  en: {
    common: {
      footer:
        "This email was sent automatically by DMS (Document Management System).",
      greeting: "Hello {name},",
    },
    subjects: {
      approvalRequest: "Approval Request: {title}",
      preparerApprovalRequest: "Preparer Approval Request: {title}",
      approverApprovalRequest: "Final Approval Request: {title}",
      preparerApproved: "Preparer Approved: {title}",
      documentApproved: "Document Approved: {title}",
      documentRejected: "Document Rejected: {title}",
      documentCancelled: "Document Cancelled: {title}",
      documentRevised: "Document Revised: {title}",
      readAssignment: "Read Assignment: {title}",
      documentDistributed: "Document Notification: {title}",
      approvalReminder: "Reminder: {title} pending approval",
      readReminder: "Reminder: {title} pending read confirmation",
      escalation: "Escalation: {title}",
      welcome: "DMS - Set Your Password",
      testEmail: "DMS - Test Email",
    },
    approvalRequest: {
      preview: "Approval Request: {title}",
      heading: "Approval Request",
      preparerBody: "The document {documentTitle} submitted by {uploaderName} is awaiting your approval as preparer. Please review and approve the document.",
      approverBody: "The document {documentTitle} has been approved by the preparer. Please review for final approval.",
      documentCodeLabel: "Document Code",
      button: "Review Document",
    },
    preparerApproved: {
      preview: "Preparer Approved: {title}",
      heading: "Preparer Approval Completed",
      body: "The document {documentTitle} ({documentCode}) has been approved as preparer by {preparerName}. Please review for final approval.",
      documentCodeLabel: "Document Code",
      button: "Review and Approve",
    },
    approvalReminder: {
      preview: "Reminder: {title} pending approval",
      heading: "Approval Reminder",
      body: "The document {documentTitle} ({documentCode}) has been awaiting your approval for {daysPending} days.",
      warning: "Please review the document as soon as possible.",
      button: "Review Document",
    },
    documentApproved: {
      preview: "Approved: {title}",
      heading: "Document Approved",
      body: "The document {documentTitle} ({documentCode}) has been approved by {approvedBy}.",
      info: "You can now publish your document.",
      button: "Publish Document",
    },
    documentRejected: {
      preview: "Rejected: {title}",
      heading: "Document Rejected",
      body: "The document {documentTitle} ({documentCode}) has been rejected by {rejectedBy}.",
      reasonLabel: "Rejection Reason:",
      afterReason:
        "You can edit the document and resubmit it for approval.",
      button: "Edit Document",
      rejectedByPreparer: "Preparer",
      rejectedByApprover: "Approver",
    },
    documentRevised: {
      preview: "Revised: {title}",
      heading: "Document Revised",
      body: "The document {documentTitle} ({documentCode}) has been revised by {revisedBy}.",
      revisionLabel: "Revision Number:",
      notesLabel: "Revision Notes:",
      info: "The new version is awaiting your review.",
      button: "View Document",
    },
    documentCancelled: {
      preview: "Cancelled: {title}",
      heading: "Document Cancelled",
      body: "The document {documentTitle} ({documentCode}) has been cancelled by {cancelledBy}.",
      warning:
        "This document is no longer valid and should not be used.",
    },
    readAssignment: {
      preview: "Read Assignment: {title}",
      heading: "Read Assignment",
      body: "You are required to read the document {documentTitle} ({documentCode}) published by {publishedBy}.",
      info: "You must confirm that you have read the document.",
      button: "Read Document",
    },
    documentDistributed: {
      preview: "Document Distribution: {title}",
      heading: "Document Notification",
      body: "The document {documentTitle} ({documentCode}) published by {publishedBy} has been distributed to you for your information.",
      info: "This document has been shared with you for informational purposes.",
      button: "View Document",
    },
    readReminder: {
      preview: "Reminder: {title} pending read confirmation",
      heading: "Read Reminder",
      body: "You have not read or confirmed the document {documentTitle} ({documentCode}) for {daysPending} days.",
      warning:
        "Please read and confirm the document as soon as possible.",
      button: "Read and Confirm",
    },
    escalationNotice: {
      preview: "Escalation: {title}",
      heading: "Escalation Notice",
      body: "The document {documentTitle} ({documentCode}) has not been approved by {originalApprover} for {daysPending} days. The document has been escalated to you for approval.",
      reasonLabel: "Escalation Reason",
      reasonText:
        "The original approver {originalApprover} did not approve within the specified timeframe. The document has been pending for {daysPending} days.",
      afterReason:
        "Please review the document and take the necessary action.",
      button: "Review Document",
    },
    welcome: {
      preview: "Welcome to DMS",
      heading: "Welcome!",
      body: "Hello {userName}, your DMS (Document Management System) account has been created. Click the button below to set your password.",
      info: "This link is valid for 24 hours. You can request a new link if it expires.",
      button: "Set My Password",
    },
    testEmail: {
      body: "This is a test email. Your email settings have been configured correctly.",
    },
  },
};
