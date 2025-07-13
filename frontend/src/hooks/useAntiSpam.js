import { useState, useEffect, useCallback } from 'react';
import { emailService } from '../services/api';

const useAntiSpam = () => {
    const [antiSpamData, setAntiSpamData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchAntiSpamData = useCallback(async () => {
        try {
            const data = await emailService.getAntiSpamSummary();
            setAntiSpamData(data);
            setError(null);
            return data;
        } catch (err) {
            setError('Failed to fetch anti-spam data');
            console.error('Anti-spam fetch error:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    const checkCanSend = useCallback(async (emailCount = 1) => {
        if (!antiSpamData) {
            const data = await fetchAntiSpamData();
            if (!data) return { canSend: false, reason: 'Unable to verify sending limits' };
        }

        const currentData = antiSpamData || await fetchAntiSpamData();
        
        // Check if suspended
        if (currentData.is_suspended) {
            return {
                canSend: false,
                reason: `Account suspended: ${currentData.suspension_reason}`,
                type: 'suspended'
            };
        }

        // Check daily limit
        const dailyRemaining = currentData.usage_today.daily_remaining;
        if (emailCount > dailyRemaining) {
            return {
                canSend: false,
                reason: `Daily limit would be exceeded. You can send ${dailyRemaining} more emails today.`,
                type: 'daily_limit',
                remaining: dailyRemaining
            };
        }

        // Check hourly limit
        const hourlyRemaining = currentData.usage_today.hourly_remaining;
        if (emailCount > hourlyRemaining) {
            return {
                canSend: false,
                reason: `Hourly limit would be exceeded. You can send ${hourlyRemaining} more emails this hour.`,
                type: 'hourly_limit',
                remaining: hourlyRemaining
            };
        }

        // Check if approaching limits
        const dailyUsagePercent = (currentData.usage_today.emails_sent / currentData.limits.daily) * 100;
        const hourlyUsagePercent = (currentData.usage_today.hourly_sent / currentData.limits.hourly) * 100;

        const warnings = [];
        if (dailyUsagePercent >= 80) {
            warnings.push(`You've used ${Math.round(dailyUsagePercent)}% of your daily limit`);
        }
        if (hourlyUsagePercent >= 80) {
            warnings.push(`You've used ${Math.round(hourlyUsagePercent)}% of your hourly limit`);
        }

        return {
            canSend: true,
            warnings,
            dailyRemaining,
            hourlyRemaining,
            limits: currentData.limits
        };
    }, [antiSpamData, fetchAntiSpamData]);

    const checkEmailContent = useCallback(async (email) => {
        try {
            const result = await emailService.checkEmailBeforeSend(
                email.to_email || email.recipient_email,
                email.subject,
                email.content || email.body
            );
            return result;
        } catch (err) {
            console.error('Email content check error:', err);
            return { 
                can_send: true, 
                spam_check: { risk_level: 'unknown' } 
            };
        }
    }, []);

    const getStatusColor = useCallback(() => {
        if (!antiSpamData) return 'secondary';
        if (antiSpamData.is_suspended) return 'danger';
        
        const dailyUsagePercent = (antiSpamData.usage_today.emails_sent / antiSpamData.limits.daily) * 100;
        const hourlyUsagePercent = (antiSpamData.usage_today.hourly_sent / antiSpamData.limits.hourly) * 100;
        
        if (dailyUsagePercent >= 90 || hourlyUsagePercent >= 90) return 'danger';
        if (dailyUsagePercent >= 70 || hourlyUsagePercent >= 70) return 'warning';
        return 'success';
    }, [antiSpamData]);

    const formatTimeUntilReset = useCallback(() => {
        const now = new Date();
        const nextHour = new Date(now);
        nextHour.setHours(now.getHours() + 1, 0, 0, 0);
        
        const minutesUntilHourly = Math.floor((nextHour - now) / 60000);
        
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        
        const hoursUntilDaily = Math.floor((tomorrow - now) / 3600000);
        
        return {
            hourly: `${minutesUntilHourly} minutes`,
            daily: `${hoursUntilDaily} hours`
        };
    }, []);

    useEffect(() => {
        fetchAntiSpamData();
        
        // Refresh every minute
        const interval = setInterval(fetchAntiSpamData, 60000);
        return () => clearInterval(interval);
    }, [fetchAntiSpamData]);

    return {
        antiSpamData,
        loading,
        error,
        checkCanSend,
        checkEmailContent,
        getStatusColor,
        formatTimeUntilReset,
        refresh: fetchAntiSpamData
    };
};

export default useAntiSpam;