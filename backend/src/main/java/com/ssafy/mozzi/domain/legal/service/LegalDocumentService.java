package com.ssafy.mozzi.domain.legal.service;

import org.springframework.stereotype.Service;

import com.ssafy.mozzi.domain.legal.dto.LegalDocumentResponseDto;
import com.ssafy.mozzi.domain.member.entity.TermsType;
import com.ssafy.mozzi.domain.member.service.TermsProperties;

/**
 * The terms as JSON. The version comes from the properties sign-up checks against, so the
 * text and the version to agree to are read from the same place as {@code GET /meta}.
 */
@Service
public class LegalDocumentService {

    private final LegalDocuments legalDocuments;
    private final TermsProperties termsProperties;

    public LegalDocumentService(LegalDocuments legalDocuments, TermsProperties termsProperties) {
        this.legalDocuments = legalDocuments;
        this.termsProperties = termsProperties;
    }

    public LegalDocumentResponseDto get(TermsType type) {
        LegalDocuments.Document document = legalDocuments.document(type);
        return new LegalDocumentResponseDto(
                type, termsProperties.currentVersions().get(type), document.title(), document.markdown());
    }

}
