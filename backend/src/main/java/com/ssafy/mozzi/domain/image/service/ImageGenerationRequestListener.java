package com.ssafy.mozzi.domain.image.service;

import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.beans.factory.DisposableBean;
import org.springframework.core.task.TaskRejectedException;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Hands committed picture requests to {@link ImageRequestDispatcher} on its own small pool.
 *
 * <p>The pool is kept inside this class rather than declared as a bean: an {@code Executor}
 * bean would switch off Boot's default task executor, which emotion search's {@code @Async}
 * runs on (see {@code AsyncConfig}). It is bounded, because a pool without a limit turns a
 * burst of requests into a burst of threads.
 *
 * <p>Submitted by hand rather than through {@code @Async}, so a full pool is handled here
 * instead of surfacing as an exception after the member's request already committed. The
 * request is then given up at once, without counting as a failure; nothing else would ever
 * move it out of {@code PENDING}, and the member can ask again.
 */
@Component
public class ImageGenerationRequestListener implements DisposableBean {

    private static final Logger log = LoggerFactory.getLogger(ImageGenerationRequestListener.class);

    private final ImageRequestDispatcher dispatcher;
    private final DiaryImageResultService resultService;
    private final ThreadPoolTaskExecutor executor;

    public ImageGenerationRequestListener(ImageRequestDispatcher dispatcher, DiaryImageResultService resultService) {
        this.dispatcher = dispatcher;
        this.resultService = resultService;
        this.executor = newExecutor();
    }

    @TransactionalEventListener
    public void onRequested(ImageGenerationRequestedEvent event) {
        try {
            executor.execute(() -> dispatcher.dispatch(event));
        } catch (TaskRejectedException e) {
            log.error("image pipeline: step=rejected reason=executor-full diaryId={}", event.diaryId());
            resultService.abandon(event.diaryId());
        }
    }

    /** Finishes what was accepted rather than leave it {@code PENDING} forever. */
    @Override
    public void destroy() {
        executor.shutdown();
    }

    private static ThreadPoolTaskExecutor newExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setThreadNamePrefix("image-");
        // Each task is one translation call of about a second plus one queue send.
        executor.setCorePoolSize(2);
        executor.setMaxPoolSize(4);
        executor.setQueueCapacity(200);
        executor.setTaskDecorator(ImageGenerationRequestListener::withCallerMdc);
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(30);
        executor.initialize();
        return executor;
    }

    /**
     * Carries the request's MDC (trace id, member id) into the task. The MDC is per thread,
     * so without this a background failure cannot be traced back to the request that caused
     * it (convention 5.4).
     */
    private static Runnable withCallerMdc(Runnable task) {
        Map<String, String> context = MDC.getCopyOfContextMap();
        return () -> {
            Map<String, String> previous = MDC.getCopyOfContextMap();
            if (context == null) {
                MDC.clear();
            } else {
                MDC.setContextMap(context);
            }
            try {
                task.run();
            } finally {
                if (previous == null) {
                    MDC.clear();
                } else {
                    MDC.setContextMap(previous);
                }
            }
        };
    }

}
