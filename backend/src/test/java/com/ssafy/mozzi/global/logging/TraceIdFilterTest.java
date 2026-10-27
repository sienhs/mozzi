package com.ssafy.mozzi.global.logging;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class TraceIdFilterTest {

    private final TraceIdFilter filter = new TraceIdFilter();

    @AfterEach
    void clearMdc() {
        MDC.clear();
    }

    @Test
    void generatesAW3cShapedTraceIdWhenTheRequestCarriesNone() throws Exception {
        MockHttpServletResponse response = run(new MockHttpServletRequest("GET", "/api/v1/home"));

        assertThat(response.getHeader(RequestTrace.TRACE_ID_HEADER)).matches("[0-9a-f]{32}");
    }

    @Test
    void reusesTheTraceIdFromAW3cTraceparent() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/home");
        request.addHeader("traceparent", "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01");

        MockHttpServletResponse response = run(request);

        assertThat(response.getHeader(RequestTrace.TRACE_ID_HEADER))
                .isEqualTo("0af7651916cd43dd8448eb211c80319c");
    }

    @Test
    void reusesAnExplicitTraceIdHeader() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/home");
        request.addHeader(RequestTrace.TRACE_ID_HEADER, "0af7651916cd43dd8448eb211c80319c");

        MockHttpServletResponse response = run(request);

        assertThat(response.getHeader(RequestTrace.TRACE_ID_HEADER))
                .isEqualTo("0af7651916cd43dd8448eb211c80319c");
    }

    /**
     * The id is written into log lines, so a header with a newline in it could forge an
     * entry. Anything that is not 32 hex characters is replaced rather than sanitised.
     */
    @Test
    void rejectsATraceIdThatCouldForgeALogLine() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/home");
        request.addHeader(RequestTrace.TRACE_ID_HEADER, "abc\nERROR real-looking log line");

        MockHttpServletResponse response = run(request);

        assertThat(response.getHeader(RequestTrace.TRACE_ID_HEADER)).matches("[0-9a-f]{32}");
    }

    @Test
    void rejectsTheAllZeroTraceId() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/home");
        request.addHeader(RequestTrace.TRACE_ID_HEADER, "00000000000000000000000000000000");

        MockHttpServletResponse response = run(request);

        assertThat(response.getHeader(RequestTrace.TRACE_ID_HEADER))
                .isNotEqualTo("00000000000000000000000000000000");
    }

    @Test
    void rejectsAnUppercaseTraceId() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/home");
        request.addHeader(RequestTrace.TRACE_ID_HEADER, "0AF7651916CD43DD8448EB211C80319C");

        MockHttpServletResponse response = run(request);

        assertThat(response.getHeader(RequestTrace.TRACE_ID_HEADER)).matches("[0-9a-f]{32}");
    }

    /** Servlet threads are pooled, so a leaked id would be stamped on the next request. */
    @Test
    void clearsTheContextAfterTheRequest() throws Exception {
        run(new MockHttpServletRequest("GET", "/api/v1/home"));

        assertThat(RequestTrace.traceId()).isNull();
    }

    @Test
    void exposesTheTraceIdWhileTheRequestRuns() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/home");
        request.addHeader(RequestTrace.TRACE_ID_HEADER, "0af7651916cd43dd8448eb211c80319c");
        MockHttpServletResponse response = new MockHttpServletResponse();
        String[] seen = new String[1];
        MockFilterChain chain = new MockFilterChain() {

            @Override
            public void doFilter(jakarta.servlet.ServletRequest req, jakarta.servlet.ServletResponse res) {
                seen[0] = RequestTrace.traceId();
            }

        };

        filter.doFilter(request, response, chain);

        assertThat(seen[0]).isEqualTo("0af7651916cd43dd8448eb211c80319c");
    }

    private MockHttpServletResponse run(MockHttpServletRequest request) throws Exception {
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, new MockFilterChain());
        return response;
    }

}
