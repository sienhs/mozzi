package com.ssafy.mozzi.domain.legal.service;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

import org.commonmark.Extension;
import org.commonmark.ext.gfm.tables.TablesExtension;
import org.commonmark.parser.Parser;
import org.commonmark.renderer.html.HtmlRenderer;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.springframework.web.util.HtmlUtils;

import com.ssafy.mozzi.domain.member.entity.TermsType;

/**
 * The terms and privacy pages, rendered once at start-up from {@code docs/legal} (copied onto
 * the classpath by {@code processResources}).
 *
 * <p>Served two ways: as a page for browsers and the store listing ({@code /legal/*}), and as
 * Markdown for the app to draw itself ({@code GET /api/v1/legal/*}). Either way a wording fix
 * reaches members without an app release. A missing document fails start-up rather than
 * answering 404 to someone reading the terms.
 */
@Component
public class LegalDocuments {

    private static final Map<TermsType, String> PATHS = Map.of(
            TermsType.TERMS, "/legal/terms",
            TermsType.PRIVACY, "/legal/privacy");

    private static final Map<TermsType, String> SOURCES = Map.of(
            TermsType.TERMS, "legal/TERMS.md",
            TermsType.PRIVACY, "legal/PRIVACY.md");

    private final Map<TermsType, String> pages = new EnumMap<>(TermsType.class);
    private final Map<TermsType, Document> documents = new EnumMap<>(TermsType.class);

    public LegalDocuments() {
        List<Extension> extensions = List.of(TablesExtension.create());
        Parser parser = Parser.builder().extensions(extensions).build();
        // The documents are ours, but nothing in them needs raw HTML, so none gets through.
        HtmlRenderer renderer = HtmlRenderer.builder().extensions(extensions)
                .escapeHtml(true).sanitizeUrls(true).build();
        SOURCES.forEach((type, source) -> {
            String markdown = read(source);
            String title = titleOf(markdown);
            documents.put(type, new Document(title, markdown));
            pages.put(type, page(title, renderer.render(parser.parse(markdown))));
        });
    }

    /** Where each document's page is served, relative to the server's origin. */
    public static Map<TermsType, String> paths() {
        return new EnumMap<>(PATHS);
    }

    public String html(TermsType type) {
        return pages.get(type);
    }

    public Document document(TermsType type) {
        return documents.get(type);
    }

    private static String read(String source) {
        try (InputStream in = new ClassPathResource(source).getInputStream()) {
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new UncheckedIOException("legal document missing from the classpath: " + source, e);
        }
    }

    /** The document's first {@code # } heading. */
    private static String titleOf(String markdown) {
        return markdown.lines()
                .filter(line -> line.startsWith("# "))
                .map(line -> line.substring(2).strip())
                .findFirst()
                .orElse("오늘의 모찌");
    }

    private static String page(String title, String body) {
        return """
                <!doctype html>
                <html lang="ko">
                <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <title>%s</title>
                <style>
                body { margin: 0 auto; max-width: 720px; padding: 24px 16px 48px; font-family: system-ui, sans-serif;
                  line-height: 1.7; color: #2b2522; background: #f8f6f2; word-break: keep-all; }
                h1 { font-size: 1.5rem; } h2 { font-size: 1.15rem; margin-top: 2em; }
                table { border-collapse: collapse; display: block; overflow-x: auto; }
                th, td { border: 1px solid #ddd6cf; padding: 6px 10px; text-align: left; vertical-align: top; }
                a { color: #8a5a44; }
                </style>
                </head>
                <body>
                %s</body>
                </html>
                """.formatted(HtmlUtils.htmlEscape(title), body);
    }

    /**
     * @param title    the first {@code # } heading
     * @param markdown the whole source, that heading included, as the app's bundled copy has it
     */
    public record Document(String title, String markdown) {
    }

}
