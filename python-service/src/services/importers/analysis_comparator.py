"""Analysis comparison service for tracking contradictions."""

from typing import Dict, Any


class AnalysisComparator:
    """Compare initial relevance checks with detailed analysis results."""
    
    async def compare_analyses(
        self,
        initial_relevance: bool,
        detailed_analysis: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Compare initial vs detailed analysis.
        
        Args:
            initial_relevance: Initial relevance decision from bulk import
            detailed_analysis: Detailed analysis result with recommendation
            
        Returns:
            Dictionary containing comparison results:
            {
                'agrees': bool,
                'initial_relevant': bool,
                'detailed_recommendation': str,
                'contradiction_severity': float,  # 0-1
            }
        """
        detailed_relevant = detailed_analysis['recommendation'] == 'include'
        agrees = initial_relevance == detailed_relevant
        
        # Calculate contradiction severity
        # If they disagree, severity is 1.0
        # If they agree, severity is 0.0
        severity = 0.0 if agrees else 1.0
        
        return {
            'agrees': agrees,
            'initial_relevant': initial_relevance,
            'detailed_recommendation': detailed_analysis['recommendation'],
            'contradiction_severity': severity,
            'initial_confidence': detailed_analysis.get('confidence', 0.0),
        }
